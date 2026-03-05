import { useState } from 'react';

interface LayerControlProps {
  layers: { districts: boolean; crime: boolean; infra: boolean };
  opacity: number;
  onToggle: (layer: keyof LayerControlProps['layers']) => void;
  onOpacity: (v: number) => void;
}

const LAYER_META: { key: keyof LayerControlProps['layers']; label: string; icon: string }[] = [
  { key: 'districts', label: 'District Boundaries', icon: '◎' },
  { key: 'crime', label: 'Crime Heatmap', icon: '▦' },
  { key: 'infra', label: 'Infrastructure', icon: '⬡' },
];

export default function LayerControl({
  layers,
  opacity,
  onToggle,
  onOpacity,
}: LayerControlProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="absolute right-4 top-4 z-10 w-56">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/90 px-4 py-2.5 text-xs font-semibold text-slate-200 shadow-xl shadow-black/20 backdrop-blur-sm transition-colors hover:border-indigo-500/30"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm">⚙</span>
          Map Layers
        </span>
        <span className={`text-[0.65rem] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-slate-700/60 bg-slate-900/90 p-4 shadow-xl shadow-black/20 backdrop-blur-sm">
          <div className="space-y-2">
            {LAYER_META.map(({ key, label, icon }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-800/50"
              >
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() => onToggle(key)}
                    className="peer sr-only"
                  />
                  <div className="h-4 w-4 rounded border border-slate-600 bg-slate-800 transition-colors peer-checked:border-indigo-500 peer-checked:bg-indigo-600" />
                  <svg
                    className="absolute left-0.5 top-0.5 hidden h-3 w-3 text-white peer-checked:block"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[0.78rem] text-slate-300">{icon} {label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-700/40 pt-3">
            <div className="flex items-center justify-between text-[0.7rem] text-slate-400">
              <span>Opacity</span>
              <span className="font-mono">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => onOpacity(Number(e.target.value))}
              className="mt-1.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
