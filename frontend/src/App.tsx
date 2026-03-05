import { useState, useRef } from 'react';
import MapView from './components/MapView';
import type { MapViewHandle } from './components/MapView';
import LayerControl from './components/LayerControl';
import CasePanel from './components/CasePanel';
import InfoPanel from './components/InfoPanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import StatsBar from './components/StatsBar';

type SidebarTab = 'home' | 'cases' | 'district' | 'analytics';

const NAV_ITEMS: { key: SidebarTab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'cases', label: 'Cases', icon: '⚖' },
  { key: 'district', label: 'Districts', icon: '◎' },
  { key: 'analytics', label: 'Analytics', icon: '▤' },
];

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
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100">
      {/* ─── Sidebar ─── */}
      <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold">
            ◈
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">India Civic Transparency</h1>
            <p className="text-[0.65rem] text-slate-400 tracking-wide">Civic data dashboard</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 py-3">
          {NAV_ITEMS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.8rem] font-medium transition-all duration-150
                ${tab === key
                  ? 'bg-indigo-600/20 text-indigo-300 shadow-sm shadow-indigo-500/10'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="mx-3 border-t border-slate-800" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
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

        {/* Footer */}
        <div className="border-t border-slate-800 px-5 py-3">
          <p className="text-[0.6rem] text-slate-500">v1.0 · Open Civic Data</p>
        </div>
      </aside>

      {/* ─── Map ─── */}
      <main className="relative flex-1">
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
      </main>
    </div>
  );
}
