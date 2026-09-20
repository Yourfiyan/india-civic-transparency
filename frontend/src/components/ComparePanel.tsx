import { useEffect, useState } from 'react';
import { getDistricts, getDistrictScores } from '../api';
import type { District, DistrictScoreRow } from '../types';
import { exportToCsv, exportToJson } from '../utils/exportData';

export default function ComparePanel() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [scores, setScores] = useState<Map<number, DistrictScoreRow>>(new Map());
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedB, setSelectedB] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getDistricts(), getDistrictScores().catch(() => null)])
      .then(([distRes, scoreRes]) => {
        setDistricts(distRes.districts);
        const map = new Map<number, DistrictScoreRow>();
        for (const s of scoreRes?.districts ?? []) {
          map.set(Number(s.district_id), s);
        }
        setScores(map);
        if (distRes.districts.length >= 2) {
          setSelectedA(distRes.districts[0].id);
          setSelectedB(distRes.districts[1].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const scoreA = selectedA ? scores.get(selectedA) : null;
  const scoreB = selectedB ? scores.get(selectedB) : null;
  const distA = selectedA ? districts.find((d) => d.id === selectedA) : null;
  const distB = selectedB ? districts.find((d) => d.id === selectedB) : null;

  const handleExport = (format: 'csv' | 'json') => {
    const data = [
      ...(scoreA ? [{ ...scoreA, name: distA?.name, state: distA?.state }] : []),
      ...(scoreB ? [{ ...scoreB, name: distB?.name, state: distB?.state }] : []),
    ];
    if (format === 'csv') exportToCsv('district-comparison', data);
    else exportToJson('district-comparison', data);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="ml-2 text-xs text-slate-400">Loading districts…</span>
      </div>
    );
  }

  const metrics: { label: string; key: keyof DistrictScoreRow; max: number }[] = [
    { label: 'Overall Score', key: 'score', max: 100 },
    { label: 'Crime Safety', key: 'crime_safety', max: 25 },
    { label: 'Justice Efficiency', key: 'justice_efficiency', max: 25 },
    { label: 'Infrastructure Progress', key: 'infra_progress', max: 25 },
    { label: 'Judicial Access', key: 'judicial_access', max: 25 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">District Comparison</h2>
        <div className="flex gap-1.5">
          <button
            onClick={() => handleExport('csv')}
            className="rounded bg-slate-800 px-2 py-1 text-[0.65rem] font-semibold text-slate-300 hover:bg-slate-700"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="rounded bg-slate-800 px-2 py-1 text-[0.65rem] font-semibold text-slate-300 hover:bg-slate-700"
          >
            JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[0.65rem] font-medium text-slate-400">District A</label>
          <select
            value={selectedA ?? ''}
            onChange={(e) => setSelectedA(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
          >
            {districts.map((d) => (
              <option key={`a-${d.id}`} value={d.id}>
                {d.name} ({d.state})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[0.65rem] font-medium text-slate-400">District B</label>
          <select
            value={selectedB ?? ''}
            onChange={(e) => setSelectedB(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
          >
            {districts.map((d) => (
              <option key={`b-${d.id}`} value={d.id}>
                {d.name} ({d.state})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        {metrics.map(({ label, key, max }) => {
          const valA = scoreA ? Number(scoreA[key]) : 0;
          const valB = scoreB ? Number(scoreB[key]) : 0;
          const diff = Math.round((valA - valB) * 10) / 10;

          return (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>{label}</span>
                <span className={`text-[0.65rem] ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                  {diff > 0 ? `+${diff} for A` : diff < 0 ? `${diff} for A` : 'Tied'}
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-[0.7rem]">
                  <span className="w-16 truncate text-indigo-300">{distA?.name || 'A'}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-800 h-2">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(100, (valA / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono font-bold text-slate-200">{valA.toFixed(1)}</span>
                </div>

                <div className="flex items-center gap-2 text-[0.7rem]">
                  <span className="w-16 truncate text-amber-300">{distB?.name || 'B'}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-800 h-2">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.min(100, (valB / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono font-bold text-slate-200">{valB.toFixed(1)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
