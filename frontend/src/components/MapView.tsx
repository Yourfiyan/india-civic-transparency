import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';

interface MapViewProps {
  layers: { districts: boolean; crime: boolean; infra: boolean };
  opacity: number;
  onDistrictClick: (districtId: number, name: string) => void;
}

export interface MapViewHandle {
  getMap: () => L.Map | null;
}

/** Score → fill color (red 0 → yellow 50 → green 100) */
function scoreColor(score: number): string {
  const t = Math.max(0, Math.min(100, score)) / 100;
  if (t < 0.5) {
    const s = t * 2;
    return `rgb(${Math.round(239 * (1 - s) + 234 * s)},${Math.round(68 * (1 - s) + 179 * s)},${Math.round(68 * (1 - s) + 8 * s)})`;
  }
  const s = (t - 0.5) * 2;
  return `rgb(${Math.round(234 * (1 - s) + 34 * s)},${Math.round(179 * (1 - s) + 197 * s)},${Math.round(8 * (1 - s) + 94 * s)})`;
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(
  ({ layers, opacity, onDistrictClick }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const districtLayerRef = useRef<L.GeoJSON | null>(null);
    const crimeLayerRef = useRef<L.LayerGroup | null>(null);
    const infraLayerRef = useRef<L.LayerGroup | null>(null);
    const selectedIdRef = useRef<number | null>(null);
    const opacityRef = useRef(opacity);
    const onDistrictClickRef = useRef(onDistrictClick);
    opacityRef.current = opacity;
    onDistrictClickRef.current = onDistrictClick;

    const [mapError, setMapError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getMap: () => mapRef.current,
    }));

    /* ── Initialise Leaflet map (Canvas renderer — no WebGL needed) ── */
    useEffect(() => {
      if (!containerRef.current) return;

      /* Prevent StrictMode double-init: if a map already exists on this
         DOM node, destroy it first so we get a clean slate. */
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        districtLayerRef.current = null;
        crimeLayerRef.current = null;
        infraLayerRef.current = null;
      }

      let cancelled = false;               // ← cancellation flag for async work

      const map = L.map(containerRef.current, {
        center: [22.5, 78.9],
        zoom: 5,
        minZoom: 4,
        maxZoom: 10,
        renderer: L.canvas(),
        zoomControl: false,
        attributionControl: false,
        maxBounds: L.latLngBounds([6.0, 68.0], [37.5, 97.5]),
        maxBoundsViscosity: 1.0,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      /* Try adding a dark tile layer — fails gracefully in Colab */
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
        errorTileUrl: '',           // don't show broken-image icons
      }).addTo(map);

      mapRef.current = map;

      /* ── Load district data ── */
      (async () => {
        try {
          const [topoRes, scoreRes] = await Promise.all([
            fetch('/api/districts/topojson'),
            fetch('/api/analytics/district-score').catch(() => null),
          ]);

          /* ── Bail out if component unmounted (StrictMode cleanup) ── */
          if (cancelled) return;

          if (!topoRes.ok) throw new Error(`TopoJSON ${topoRes.status}`);
          const topo: Topology = await topoRes.json();
          const objectKey = Object.keys(topo.objects)[0];
          const geojson = topojson.feature(
            topo,
            topo.objects[objectKey] as GeometryCollection,
          ) as GeoJSON.FeatureCollection;

          /* Build score lookup */
          const scoreMap = new Map<number, number>();
          if (scoreRes?.ok) {
            const scoreData = await scoreRes.json();
            for (const d of scoreData.districts ?? []) {
              scoreMap.set(Number(d.district_id ?? d.id), Number(d.score));
            }
          }

          /* Merge scores */
          for (const f of geojson.features) {
            const fid = Number(f.properties?.id ?? f.properties?.district_id);
            f.properties = { ...f.properties, _score: scoreMap.get(fid) ?? 50 };
          }

          /* ── Final cancelled check before DOM mutation ── */
          if (cancelled) return;

          /* ── Create GeoJSON layer ── */
          const geoLayer = L.geoJSON(geojson, {
            style: (feature) => {
              const sc = feature?.properties?._score ?? 50;
              return {
                fillColor: scoreColor(sc),
                fillOpacity: opacityRef.current,
                color: '#cbd5e1',
                weight: 1.5,
                opacity: 0.9,
              };
            },
            onEachFeature: (feature, layer) => {
              const props = feature.properties;
              const id = Number(props?.id ?? props?.district_id);
              const name = props?.name ?? 'Unknown';
              const sc = props?._score;

              /* Tooltip */
              const tip = sc != null
                ? `<strong>${name}</strong><br/><span style="font-size:11px;color:#94a3b8">Score: ${Number(sc).toFixed(1)}</span>`
                : `<strong>${name}</strong>`;
              layer.bindTooltip(tip, {
                sticky: true,
                direction: 'top',
                className: 'district-tooltip',
              });

              /* Hover */
              layer.on('mouseover', () => {
                (layer as L.Path).setStyle({
                  fillColor: '#a5b4fc',
                  fillOpacity: 0.7,
                  weight: 2,
                });
              });

              layer.on('mouseout', () => {
                if (selectedIdRef.current === id) {
                  (layer as L.Path).setStyle({
                    fillColor: '#f59e0b',
                    fillOpacity: 0.75,
                    color: '#fbbf24',
                    weight: 2.5,
                  });
                } else {
                  geoLayer.resetStyle(layer as L.Path);
                }
              });

              /* Click — use ref so closure always has latest callback */
              layer.on('click', () => {
                geoLayer.eachLayer((l) => geoLayer.resetStyle(l as L.Path));
                selectedIdRef.current = id;
                (layer as L.Path).setStyle({
                  fillColor: '#f59e0b',
                  fillOpacity: 0.75,
                  color: '#fbbf24',
                  weight: 2.5,
                });
                onDistrictClickRef.current(id, name);
              });
            },
          }).addTo(map);

          districtLayerRef.current = geoLayer;

          /* Fit to India bounds */
          map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });

          console.log('[MapView] Leaflet: Districts loaded:', geojson.features.length);
        } catch (err) {
          if (cancelled) return;
          console.error('[MapView] Failed to load districts:', err);
          setMapError('Failed to load district data. Please refresh.');
        }
      })();

      /* ── Load crime heatmap data ── */
      (async () => {
        try {
          const res = await fetch('/api/crime/geo');
          if (cancelled) return;
          if (!res.ok) throw new Error(`Crime geo ${res.status}`);
          const data = await res.json();
          if (cancelled) return;

          const maxCases = Math.max(...data.districts.map((d: any) => d.total_cases), 1);
          const group = L.layerGroup();

          for (const d of data.districts) {
            const radius = 6 + (d.total_cases / maxCases) * 24;
            L.circleMarker([d.lat, d.lng], {
              radius,
              fillColor: '#ef4444',
              fillOpacity: 0.25 + (d.total_cases / maxCases) * 0.45,
              color: '#fca5a5',
              weight: 1,
              interactive: true,
            })
              .bindTooltip(
                `<strong>${d.name}</strong><br/>` +
                `<span style="font-size:11px;color:#fca5a5">Cases: ${Number(d.total_cases).toLocaleString()}</span><br/>` +
                `<span style="font-size:11px;color:#86efac">Convicted: ${Number(d.total_convicted).toLocaleString()}</span>`,
                { sticky: true, direction: 'top' },
              )
              .addTo(group);
          }

          crimeLayerRef.current = group;
          // Don't add to map by default — toggle handles it
          console.log('[MapView] Crime layer ready:', data.districts.length, 'districts');
        } catch (err) {
          if (cancelled) return;
          console.warn('[MapView] Crime geo load failed:', err);
        }
      })();

      /* ── Load infrastructure data ── */
      (async () => {
        try {
          const res = await fetch('/api/infrastructure/geo');
          if (cancelled) return;
          if (!res.ok) throw new Error(`Infra geo ${res.status}`);
          const data = await res.json();
          if (cancelled) return;

          const statusColor: Record<string, string> = {
            completed: '#22c55e',
            in_progress: '#eab308',
            sanctioned: '#f97316',
          };
          const group = L.layerGroup();

          for (const p of data.projects) {
            const color = statusColor[p.status] ?? '#94a3b8';
            // Offset markers slightly when multiple projects at same centroid
            const jitter = (Math.random() - 0.5) * 0.15;
            L.circleMarker([p.lat + jitter, p.lng + jitter], {
              radius: 5,
              fillColor: color,
              fillOpacity: 0.8,
              color: '#e2e8f0',
              weight: 0.5,
              interactive: true,
            })
              .bindTooltip(
                `<strong>${p.project_name}</strong><br/>` +
                `<span style="font-size:11px;color:#94a3b8">${p.district_name}, ${p.state}</span><br/>` +
                `<span style="font-size:11px;color:${color}">${p.status.replace('_', ' ')} · ${p.completion_pct ?? 0}%</span>` +
                (p.sanctioned_cost ? `<br/><span style="font-size:11px;color:#cbd5e1">₹${(p.sanctioned_cost / 1e7).toFixed(1)} Cr</span>` : ''),
                { sticky: true, direction: 'top' },
              )
              .addTo(group);
          }

          infraLayerRef.current = group;
          console.log('[MapView] Infra layer ready:', data.projects.length, 'projects');
        } catch (err) {
          if (cancelled) return;
          console.warn('[MapView] Infra geo load failed:', err);
        }
      })();

      /* ── ResizeObserver ── */
      const ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(containerRef.current);

      return () => {
        cancelled = true;                   // ← abort in-flight async work
        ro.disconnect();
        map.remove();
        mapRef.current = null;
        districtLayerRef.current = null;
        crimeLayerRef.current = null;
        infraLayerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── Toggle district layer visibility ── */
    useEffect(() => {
      const map = mapRef.current;
      const layer = districtLayerRef.current;
      if (!map || !layer) return;

      if (layers.districts) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    }, [layers.districts]);

    /* ── Toggle crime layer visibility ── */
    useEffect(() => {
      const map = mapRef.current;
      const layer = crimeLayerRef.current;
      if (!map || !layer) return;

      if (layers.crime) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    }, [layers.crime]);

    /* ── Toggle infra layer visibility ── */
    useEffect(() => {
      const map = mapRef.current;
      const layer = infraLayerRef.current;
      if (!map || !layer) return;

      if (layers.infra) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    }, [layers.infra]);

    /* ── Update opacity ── */
    useEffect(() => {
      const layer = districtLayerRef.current;
      if (!layer) return;
      layer.eachLayer((l) => {
        (l as L.Path).setStyle({ fillOpacity: opacity });
      });
    }, [opacity]);

    return (
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ background: '#1e293b' }}
      >
        {mapError && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-900/80">
            <div className="rounded-lg bg-slate-800 px-6 py-4 text-center shadow-lg">
              <p className="text-sm text-rose-400">{mapError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 rounded bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Reload Page
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

MapView.displayName = 'MapView';
export default MapView;
