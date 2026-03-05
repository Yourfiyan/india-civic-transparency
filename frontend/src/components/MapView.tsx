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

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            'carto-light': {
              type: 'raster',
              tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; <a href="https://carto.com">CARTO</a>',
            },
          },
          layers: [
            {
              id: 'carto-light-layer',
              type: 'raster',
              source: 'carto-light',
              minzoom: 0,
              maxzoom: 20,
            },
          ],
        },
        center: [78.9, 22.5],
        zoom: 4,
        minZoom: 4,
        maxZoom: 10,
        maxBounds: INDIA_BOUNDS,
      });

      map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
      mapRef.current = map;

      hoverPopup.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
      });

      map.on('load', async () => {
        try {
          const res = await fetch('/api/districts/topojson');
          if (!res.ok) return;
          const topo: Topology = await res.json();
          const objectKey = Object.keys(topo.objects)[0];
          const geojson = topojson.feature(
            topo,
            topo.objects[objectKey] as GeometryCollection
          );

          map.addSource('districts', { type: 'geojson', data: geojson });

          /* base fill */
          map.addLayer({
            id: 'districts-fill',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': '#6366f1',
              'fill-opacity': 0.15,
            },
          });

          /* border */
          map.addLayer({
            id: 'districts-line',
            type: 'line',
            source: 'districts',
            paint: {
              'line-color': '#818cf8',
              'line-width': 0.8,
              'line-opacity': 0.6,
            },
          });

          /* hover highlight */
          map.addLayer({
            id: 'districts-hover',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': '#818cf8',
              'fill-opacity': 0.35,
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
              'fill-opacity': 0.45,
            },
            filter: ['==', ['get', 'id'], ''],
          });

          map.addLayer({
            id: 'districts-selected-line',
            type: 'line',
            source: 'districts',
            paint: {
              'line-color': '#fbbf24',
              'line-width': 2,
            },
            filter: ['==', ['get', 'id'], ''],
          });

          /* infrastructure markers (hidden by default) */
          map.addLayer({
            id: 'infra-markers',
            type: 'circle',
            source: 'districts',
            paint: {
              'circle-radius': 4,
              'circle-color': '#10b981',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#065f46',
              'circle-opacity': 0.8,
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

            if (id !== hoveredId.current) {
              hoveredId.current = id;
              map.setFilter('districts-hover', ['==', ['get', 'id'], id]);
            }

            map.getCanvas().style.cursor = 'pointer';
            hoverPopup.current
              ?.setLngLat(e.lngLat)
              .setHTML(`<strong>${name}</strong>`)
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
          /* TopoJSON not available */
        }
      });

      return () => {
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

      if (map.getLayer('districts-fill'))
        map.setLayoutProperty('districts-fill', 'visibility', vis(layers.districts));
      if (map.getLayer('districts-line'))
        map.setLayoutProperty('districts-line', 'visibility', vis(layers.districts));
      if (map.getLayer('districts-hover'))
        map.setLayoutProperty('districts-hover', 'visibility', vis(layers.districts));
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
