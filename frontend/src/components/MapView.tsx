import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';

interface MapViewProps {
  layers: { districts: boolean; crime: boolean; infra: boolean };
  opacity: number;
  onDistrictClick: (districtId: number, name: string) => void;
}

export interface MapViewHandle {
  getMap: () => maplibregl.Map | null;
}

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [68.0, 6.0],
  [97.5, 37.5],
];

/* Fully self-contained style — zero external network requests */
const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'blank-dark',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#1e293b' },   /* slate-800 — visible contrast */
    },
  ],
};

const MapView = forwardRef<MapViewHandle, MapViewProps>(
  ({ layers, opacity, onDistrictClick }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const hoverPopup = useRef<maplibregl.Popup | null>(null);
    const hoveredId = useRef<string | number | null>(null);

    useImperativeHandle(ref, () => ({
      getMap: () => mapRef.current,
    }));

    /* initialise map */
    useEffect(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;

      const map = new maplibregl.Map({
        container,
        style: BLANK_STYLE,
        center: [78.9, 22.5],
        zoom: 4,
        minZoom: 3,
        maxZoom: 10,
        maxBounds: INDIA_BOUNDS,
      });

      /* ResizeObserver to keep canvas in sync with flex container */
      const ro = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.resize();
      });
      ro.observe(container);

      map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
      mapRef.current = map;

      hoverPopup.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
      });

      map.on('load', async () => {
        try {
          /* ── Load district boundaries ── */
          const res = await fetch('/api/districts/topojson');
          if (!res.ok) throw new Error(`TopoJSON ${res.status}`);
          const topo: Topology = await res.json();
          const objectKey = Object.keys(topo.objects)[0];
          const geojson = topojson.feature(
            topo,
            topo.objects[objectKey] as GeometryCollection,
          );

          /* ── Merge scores into properties as numeric _score ── */
          try {
            const scoreRes = await fetch('/api/analytics/district-score');
            if (scoreRes.ok) {
              const scoreData = await scoreRes.json();
              const scoreMap = new Map<number, number>();
              for (const d of scoreData.districts ?? []) {
                scoreMap.set(Number(d.district_id ?? d.id), Number(d.score));
              }
              if ('features' in geojson) {
                for (const f of (geojson as GeoJSON.FeatureCollection).features) {
                  const fid = Number(f.properties?.id ?? f.properties?.district_id);
                  f.properties = { ...f.properties, _score: scoreMap.get(fid) ?? 50 };
                }
              }
            }
          } catch { /* scores optional */ }

          map.addSource('districts', { type: 'geojson', data: geojson });

          /* ── Fill — native interpolate on _score (no external colors) ── */
          map.addLayer({
            id: 'districts-fill',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': [
                'interpolate', ['linear'],
                ['coalesce', ['get', '_score'], 50],
                0,   '#ef4444',
                30,  '#f97316',
                50,  '#eab308',
                70,  '#84cc16',
                100, '#22c55e',
              ],
              'fill-opacity': 0.7,
            },
          });

          /* ── Border ── */
          map.addLayer({
            id: 'districts-line',
            type: 'line',
            source: 'districts',
            paint: {
              'line-color': '#cbd5e1',
              'line-width': 1.5,
              'line-opacity': 0.9,
            },
          });

          /* ── Hover highlight ── */
          map.addLayer({
            id: 'districts-hover',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': '#a5b4fc',
              'fill-opacity': 0.6,
            },
            filter: ['==', ['get', 'id'], ''],
          });

          /* ── Click highlight ── */
          map.addLayer({
            id: 'districts-selected',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': '#f59e0b',
              'fill-opacity': 0.65,
            },
            filter: ['==', ['get', 'id'], ''],
          });

          map.addLayer({
            id: 'districts-selected-line',
            type: 'line',
            source: 'districts',
            paint: {
              'line-color': '#fbbf24',
              'line-width': 2.5,
            },
            filter: ['==', ['get', 'id'], ''],
          });

          /* ── Infra markers (hidden by default) ── */
          map.addLayer({
            id: 'infra-markers',
            type: 'circle',
            source: 'districts',
            paint: {
              'circle-radius': 5,
              'circle-color': '#10b981',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#065f46',
              'circle-opacity': 0.9,
            },
            layout: { visibility: 'none' },
          });

          /* ── Hover events ── */
          map.on('mousemove', 'districts-fill', (e) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const props = feature.properties;
            const id = props?.id ?? props?.district_id;
            const name = props?.name ?? 'Unknown';
            const sc = props?._score;

            if (id !== hoveredId.current) {
              hoveredId.current = id;
              map.setFilter('districts-hover', ['==', ['get', 'id'], id]);
            }

            map.getCanvas().style.cursor = 'pointer';
            const html = sc != null
              ? `<strong>${name}</strong><br/><span style="font-size:11px;color:#94a3b8">Score: ${Number(sc).toFixed(1)}</span>`
              : `<strong>${name}</strong>`;
            hoverPopup.current
              ?.setLngLat(e.lngLat)
              .setHTML(html)
              .addTo(map);
          });

          map.on('mouseleave', 'districts-fill', () => {
            hoveredId.current = null;
            map.setFilter('districts-hover', ['==', ['get', 'id'], '']);
            map.getCanvas().style.cursor = '';
            hoverPopup.current?.remove();
          });

          /* ── Click ── */
          map.on('click', 'districts-fill', (e) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const props = feature.properties;
            const id = props?.id ?? props?.district_id;
            const name = props?.name ?? 'Unknown';
            if (id) {
              map.setFilter('districts-selected', ['==', ['get', 'id'], id]);
              map.setFilter('districts-selected-line', ['==', ['get', 'id'], id]);
              onDistrictClick(Number(id), name);
            }
          });

          console.log('[MapView] Districts loaded:', (geojson as GeoJSON.FeatureCollection).features?.length ?? 0);
        } catch (err) {
          console.error('[MapView] Failed to load districts:', err);
        }
      });

      return () => {
        ro.disconnect();
        hoverPopup.current?.remove();
        map.remove();
        mapRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* toggle layers */
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      const vis = (on: boolean): 'visible' | 'none' => on ? 'visible' : 'none';

      const districtLayers = ['districts-fill', 'districts-line', 'districts-hover'];
      for (const id of districtLayers) {
        if (map.getLayer(id))
          map.setLayoutProperty(id, 'visibility', vis(layers.districts));
      }
      if (map.getLayer('infra-markers'))
        map.setLayoutProperty('infra-markers', 'visibility', vis(layers.infra));
    }, [layers]);

    /* opacity */
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      if (map.getLayer('districts-fill'))
        map.setPaintProperty('districts-fill', 'fill-opacity', opacity);
    }, [opacity]);

    return (
      <div ref={containerRef} className="absolute inset-0" />
    );
  },
);

MapView.displayName = 'MapView';
export default MapView;
