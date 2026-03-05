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

/* Fully self-contained style — no external tile/glyph/sprite requests */
const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'blank-dark',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0f172a' },
    },
  ],
};

/* Score → color interpolation (red 0 → yellow 50 → green 100) */
function scoreColor(score: number): string {
  const t = Math.max(0, Math.min(100, score)) / 100;
  if (t < 0.5) {
    const s = t * 2;
    const r = Math.round(239 * (1 - s) + 234 * s);
    const g = Math.round(68 * (1 - s) + 179 * s);
    const b = Math.round(68 * (1 - s) + 8 * s);
    return `rgb(${r},${g},${b})`;
  }
  const s = (t - 0.5) * 2;
  const r = Math.round(234 * (1 - s) + 34 * s);
  const g = Math.round(179 * (1 - s) + 197 * s);
  const b = Math.round(8 * (1 - s) + 94 * s);
  return `rgb(${r},${g},${b})`;
}

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
        map.resize();
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
        /* Load district boundaries */
        try {
          const res = await fetch('/api/districts/topojson');
          if (!res.ok) throw new Error('TopoJSON unavailable');
          const topo: Topology = await res.json();
          const objectKey = Object.keys(topo.objects)[0];
          const geojson = topojson.feature(
            topo,
            topo.objects[objectKey] as GeometryCollection
          );

          /* Fetch scores and merge into GeoJSON properties */
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
                  const sc = scoreMap.get(fid) ?? 50;
                  f.properties = { ...f.properties, _score: sc, _color: scoreColor(sc) };
                }
              }
            }
          } catch { /* scores optional */ }

          map.addSource('districts', { type: 'geojson', data: geojson });

          /* base fill — colored by score */
          map.addLayer({
            id: 'districts-fill',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': ['coalesce', ['get', '_color'], '#6366f1'],
              'fill-opacity': opacity,
            },
          });

          /* border */
          map.addLayer({
            id: 'districts-line',
            type: 'line',
            source: 'districts',
            paint: {
              'line-color': '#94a3b8',
              'line-width': 1.5,
              'line-opacity': 0.8,
            },
          });

          /* hover highlight */
          map.addLayer({
            id: 'districts-hover',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': '#818cf8',
              'fill-opacity': 0.5,
            },
            filter: ['==', ['get', 'id'], ''],
          });

          /* click highlight */
          map.addLayer({
            id: 'districts-selected',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': '#f59e0b',
              'fill-opacity': 0.55,
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

          /* district name labels */
          map.addLayer({
            id: 'districts-labels',
            type: 'symbol',
            source: 'districts',
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 11,
              'text-anchor': 'center',
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': '#e2e8f0',
              'text-halo-color': '#0f172a',
              'text-halo-width': 1.5,
            },
          });

          /* infrastructure markers (hidden by default) */
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

          /* hover events */
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

          /* click */
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
        } catch {
          /* TopoJSON not available — map still shows dark background */
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

      const districtLayers = ['districts-fill', 'districts-line', 'districts-hover', 'districts-labels'];
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
  }
);

MapView.displayName = 'MapView';
export default MapView;
