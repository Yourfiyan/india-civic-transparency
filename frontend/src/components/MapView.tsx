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

const INDIA_CENTER: [number, number] = [78.9, 22.5];
const INDIA_ZOOM = 4;

const STYLE_URL =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const MapView = forwardRef<MapViewHandle, MapViewProps>(
  ({ layers, opacity, onDistrictClick }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    useImperativeHandle(ref, () => ({
      getMap: () => mapRef.current,
    }));

    /* initialise map */
    useEffect(() => {
      if (!containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: INDIA_CENTER,
        zoom: INDIA_ZOOM,
        minZoom: 3,
        maxZoom: 12,
      });

      map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
      mapRef.current = map;

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

          map.addLayer({
            id: 'districts-fill',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': '#0a3d62',
              'fill-opacity': 0.25,
            },
          });

          map.addLayer({
            id: 'districts-line',
            type: 'line',
            source: 'districts',
            paint: {
              'line-color': '#0a3d62',
              'line-width': 0.8,
            },
          });

          map.addLayer({
            id: 'districts-highlight',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': '#e17055',
              'fill-opacity': 0.5,
            },
            filter: ['==', ['get', 'id'], ''],
          });

          map.on('click', 'districts-fill', (e) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const props = feature.properties;
            const id = props?.id ?? props?.district_id;
            const name = props?.name ?? 'Unknown';
            if (id) {
              map.setFilter('districts-highlight', [
                '==',
                ['get', 'id'],
                id,
              ]);
              onDistrictClick(Number(id), name);
            }
          });

          map.on('mouseenter', 'districts-fill', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'districts-fill', () => {
            map.getCanvas().style.cursor = '';
          });
        } catch {
          /* TopoJSON not available yet */
        }
      });

      return () => {
        map.remove();
        mapRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* toggle layers */
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      const visibility = (on: boolean) => (on ? 'visible' : 'none');

      if (map.getLayer('districts-fill'))
        map.setLayoutProperty(
          'districts-fill',
          'visibility',
          visibility(layers.districts)
        );
      if (map.getLayer('districts-line'))
        map.setLayoutProperty(
          'districts-line',
          'visibility',
          visibility(layers.districts)
        );
    }, [layers]);

    /* opacity */
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      if (map.getLayer('districts-fill'))
        map.setPaintProperty('districts-fill', 'fill-opacity', opacity);
    }, [opacity]);

    return (
      <div
        ref={containerRef}
        className="map-container"
        style={{ width: '100%', height: '100%' }}
      />
    );
  }
);

MapView.displayName = 'MapView';
export default MapView;
