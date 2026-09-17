import { useState, useRef } from 'react';
import MapView from './components/MapView';
import type { MapViewHandle } from './components/MapView';
import LayerControl from './components/LayerControl';
import CasePanel from './components/CasePanel';
import InfoPanel from './components/InfoPanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ComparePanel from './components/ComparePanel';
import StatsBar from './components/StatsBar';
import MapLegend from './components/MapLegend';
import { useUrlState } from './hooks/useUrlState';

type SidebarTab = 'home' | 'cases' | 'district' | 'analytics' | 'compare';

const NAV_ITEMS: { key: SidebarTab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'cases', label: 'Court Cases', icon: '⚖' },
  { key: 'district', label: 'Districts', icon: '◎' },
  { key: 'compare', label: 'Compare', icon: '⇄' },
  { key: 'analytics', label: 'Analytics', icon: '▤' },
];

export default function App() {
  const mapRef = useRef<MapViewHandle>(null);
  const [urlState, setUrlState] = useUrlState();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleDistrictClick = (id: number, name: string) => {
    setUrlState({ districtId: id, districtName: name, tab: 'district' });
    setMobileDrawerOpen(true);
  };

  const toggleLayer = (key: 'districts' | 'crime' | 'infra') => {
    if (key === 'districts') setUrlState({ districtsLayer: !urlState.districtsLayer });
    if (key === 'crime') setUrlState({ crimeLayer: !urlState.crimeLayer });
    if (key === 'infra') setUrlState({ infraLayer: !urlState.infraLayer });
  };

  const layers = {
    districts: urlState.districtsLayer,
    crime: urlState.crimeLayer,
    infra: urlState.infraLayer,
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-900/95 backdrop-blur-md transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold">
              ◈
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">India Civic Transparency</h1>
              <p className="text-[0.65rem] tracking-wide text-slate-400">Open Public Data Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="rounded p-1 text-slate-400 hover:text-white md:hidden"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-800/60 p-2 md:flex-col md:border-b-0 md:px-3 md:py-3">
          {NAV_ITEMS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => {
                setUrlState({ tab: key });
                if (window.innerWidth < 768 && key !== 'district') {
                  setMobileDrawerOpen(true);
                }
              }}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[0.8rem] font-medium transition-all duration-150 md:w-full ${
                urlState.tab === key
                  ? 'bg-indigo-600/25 text-indigo-300 shadow-xs shadow-indigo-500/10'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="hidden border-t border-slate-800 md:block" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {urlState.tab === 'home' && <StatsBar />}
          {urlState.tab === 'cases' && <CasePanel />}
          {urlState.tab === 'district' && (
            <InfoPanel
              districtId={urlState.districtId}
              districtName={urlState.districtName ?? ''}
              onDistrictClick={handleDistrictClick}
            />
          )}
          {urlState.tab === 'compare' && <ComparePanel />}
          {urlState.tab === 'analytics' && <AnalyticsDashboard />}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-5 py-3">
          <p className="text-[0.65rem] text-slate-500">v1.1 · Open Civic Platform</p>
        </div>
      </aside>

      {/* ─── Map Main Area ─── */}
      <main className="relative flex-1">
        {/* Mobile menu button */}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="absolute left-4 top-4 z-[999] rounded-xl border border-slate-700/80 bg-slate-900/90 p-2.5 text-white shadow-lg backdrop-blur-sm md:hidden"
          aria-label="Open navigation menu"
        >
          ☰
        </button>

        <MapView
          ref={mapRef}
          layers={layers}
          opacity={urlState.opacity}
          onDistrictClick={handleDistrictClick}
        />

        <MapLegend />

        <LayerControl
          layers={layers}
          opacity={urlState.opacity}
          onToggle={toggleLayer}
          onOpacity={(v) => setUrlState({ opacity: v })}
        />
      </main>
    </div>
  );
}
