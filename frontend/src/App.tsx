import { useState, useRef } from 'react';
import MapView from './components/MapView';
import type { MapViewHandle } from './components/MapView';
import LayerControl from './components/LayerControl';
import CasePanel from './components/CasePanel';
import InfoPanel from './components/InfoPanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import StatsBar from './components/StatsBar';

type SidebarTab = 'home' | 'cases' | 'district' | 'analytics';

export default function App() {
  const mapRef = useRef<MapViewHandle>(null);
  const [tab, setTab] = useState<SidebarTab>('home');
  const [layers, setLayers] = useState({
    districts: true,
    crime: false,
    infra: false,
  });
  const [opacity, setOpacity] = useState(0.25);
  const [selectedDistrict, setSelectedDistrict] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const handleDistrictClick = (id: number, name: string) => {
    setSelectedDistrict({ id, name });
    setTab('district');
  };

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="app-layout">
      {/* ----- Sidebar ----- */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>India Civic Transparency</h1>
          <p>Supreme Court · Crime Stats · Infrastructure</p>
        </div>

        <div className="tab-bar">
          {(
            [
              ['home', 'Home'],
              ['cases', 'Cases'],
              ['district', 'District'],
              ['analytics', 'Analytics'],
            ] as [SidebarTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={`tab-btn ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {tab === 'home' && <StatsBar />}
          {tab === 'cases' && <CasePanel />}
          {tab === 'district' && (
            <InfoPanel
              districtId={selectedDistrict?.id ?? null}
              districtName={selectedDistrict?.name ?? ''}
            />
          )}
          {tab === 'analytics' && <AnalyticsDashboard />}
        </div>
      </div>

      {/* ----- Map ----- */}
      <div className="map-container">
        <MapView
          ref={mapRef}
          layers={layers}
          opacity={opacity}
          onDistrictClick={handleDistrictClick}
        />
        <LayerControl
          layers={layers}
          opacity={opacity}
          onToggle={toggleLayer}
          onOpacity={setOpacity}
        />
      </div>
    </div>
  );
}
