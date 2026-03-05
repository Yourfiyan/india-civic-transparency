import { useEffect, useState } from 'react';
import {
  getJudicialDelay,
  getCrimeVsJustice,
  getDistrictScores,
} from '../api';
import type {
  JudicialDelayRow,
  CrimeVsJusticeRow,
  DistrictScoreRow,
} from '../types';

type Tab = 'delay' | 'crime' | 'score';

const TABS: { key: Tab; label: string }[] = [
  { key: 'delay', label: 'Judicial Delay' },
  { key: 'crime', label: 'Crime vs Justice' },
  { key: 'score', label: 'District Scores' },
];

export default function AnalyticsDashboard() {
  const [tab, setTab] = useState<Tab>('delay');
  const [delayData, setDelayData] = useState<JudicialDelayRow[]>([]);
  const [crimeData, setCrimeData] = useState<CrimeVsJusticeRow[]>([]);
  const [scoreData, setScoreData] = useState<DistrictScoreRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    setLoading(true);
    const v = version || undefined;
    if (tab === 'delay') {
      getJudicialDelay(v).then((r) => setDelayData(r.years)).catch(() => setDelayData([])).finally(() => setLoading(false));
    } else if (tab === 'crime') {
      getCrimeVsJustice({ dataset_version: v }).then((r) => setCrimeData(r.districts)).catch(() => setCrimeData([])).finally(() => setLoading(false));
    } else {
      getDistrictScores(v).then((r) => setScoreData(r.districts)).catch(() => setScoreData([])).finally(() => setLoading(false));
    }
  }, [tab, version]);

  const maxVal = (arr: number[]) => Math.max(...arr, 1);

  return (
    <div className="space-y-4">
      {/* Version filter */}
      <input
        placeholder="Filter by version…"
        value={version}
        onChange={(e) => setVersion(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
      />

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-800/60 p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[0.72rem] font-semibold transition-all
              ${tab === key
                ? 'bg-indigo-600/30 text-indigo-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      )}

      {/* Judicial Delay */}
      {!loading && tab === 'delay' && (
        <div className="space-y-2">
          {delayData.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No data available.</p>}
          {delayData.map((row) => {
            const max = maxVal(delayData.map((d) => Number(d.avg_delay_days)));
            const pct = (Number(row.avg_delay_days) / max) * 100;
            return (
              <div key={row.year} className="flex items-center gap-3 text-xs">
                <span className="w-10 text-right font-mono text-slate-400">{row.year}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-slate-800 h-2.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-14 text-right font-mono font-semibold text-slate-300">
                  {Math.round(Number(row.avg_delay_days))}d
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Crime vs Justice */}
      {!loading && tab === 'crime' && (
        <div className="space-y-2">
          {crimeData.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No data available.</p>}
          {crimeData.slice(0, 30).map((row, i) => {
            const rate = Number(row.conviction_rate) * 100;
            return (
              <div key={`${row.name}-${row.year}-${i}`} className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-200">
                    {row.name}, {row.state}
                  </h4>
                  <span className="rounded-md bg-slate-700/50 px-1.5 py-0.5 text-[0.6rem] font-medium text-slate-400">{row.year}</span>
                </div>
                <div className="mt-2 flex gap-4 text-[0.7rem]">
                  <span className="text-slate-400">Reg: <strong className="text-slate-200">{Number(row.total_registered).toLocaleString()}</strong></span>
                  <span className="text-slate-400">Conv: <strong className="text-slate-200">{Number(row.total_convicted).toLocaleString()}</strong></span>
                  <span className={`font-bold ${rate > 50 ? 'text-emerald-400' : rate > 25 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {rate.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* District Scores */}
      {!loading && tab === 'score' && (
        <div className="space-y-3">
          {scoreData.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No data available.</p>}
          {scoreData.map((row) => {
            const max = maxVal(scoreData.map((d) => Number(d.score)));
            const bars: [string, number, string][] = [
              ['Crime Safety', Number(row.crime_safety), 'from-emerald-500 to-emerald-600'],
              ['Justice Eff.', Number(row.justice_efficiency), 'from-blue-500 to-indigo-500'],
              ['Infra', Number(row.infra_progress), 'from-amber-500 to-yellow-500'],
              ['Judicial Access', Number(row.judicial_access), 'from-rose-500 to-pink-500'],
            ];
            return (
              <div key={row.district_id} className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-200">{row.name}, {row.state}</h4>
                  <span className="rounded-lg bg-indigo-600/25 px-2 py-0.5 text-xs font-bold text-indigo-300">
                    {Number(row.score).toFixed(1)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {bars.map(([label, val, gradient]) => (
                    <div key={label} className="flex items-center gap-2 text-[0.65rem]">
                      <span className="w-20 text-right text-slate-500">{label}</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-slate-800 h-1.5">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                          style={{ width: `${(val / 25) * 100}%` }}
                        />
                      </div>
                      <span className="w-7 text-right font-mono font-semibold text-slate-400">{val.toFixed(1)}</span>
                    </div>
                  ))}
                  {/* composite */}
                  <div className="flex items-center gap-2 text-[0.65rem]">
                    <span className="w-20 text-right font-semibold text-slate-400">Composite</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-slate-800 h-1.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${(Number(row.score) / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-7 text-right font-mono font-bold text-indigo-300">{Number(row.score).toFixed(1)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
