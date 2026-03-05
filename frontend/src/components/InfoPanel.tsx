import { useEffect, useState } from 'react';
import { getDistrictDetail, getDistricts, getDistrictScores } from '../api';
import type { District, DistrictDetail } from '../types';

interface InfoPanelProps {
  districtId: number | null;
  districtName: string;
  onDistrictClick?: (id: number, name: string) => void;
}

export default function InfoPanel({ districtId, districtName, onDistrictClick }: InfoPanelProps) {
  const [detail, setDetail] = useState<DistrictDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [allDistricts, setAllDistricts] = useState<(District & { score?: number })[]>([]);
  const [listLoading, setListLoading] = useState(false);

  /* Load district list when no district selected */
  useEffect(() => {
    if (districtId) return;
    setListLoading(true);
    Promise.all([
      getDistricts(),
      getDistrictScores().catch(() => null),
    ]).then(([dRes, sRes]) => {
      const scoreMap = new Map<number, number>();
      for (const s of sRes?.districts ?? []) {
        scoreMap.set(Number(s.district_id), Number(s.score));
      }
      setAllDistricts(
        dRes.districts.map((d) => ({ ...d, score: scoreMap.get(d.id) }))
      );
    }).catch(() => setAllDistricts([]))
      .finally(() => setListLoading(false));
  }, [districtId]);

  useEffect(() => {
    if (!districtId) { setDetail(null); return; }
    setLoading(true);
    getDistrictDetail(districtId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [districtId]);

  if (!districtId) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-400">Select a district from the map or the list below.</p>
        {listLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <span className="ml-2 text-xs text-slate-400">Loading districts…</span>
          </div>
        )}
        {allDistricts.map((d) => (
          <button
            key={d.id}
            onClick={() => onDistrictClick?.(d.id, d.name)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/40 p-3 text-left transition-all duration-150 hover:border-indigo-500/30 hover:bg-slate-800/70"
          >
            <div>
              <span className="text-sm font-semibold text-slate-100">{d.name}</span>
              <span className="ml-2 text-xs text-slate-500">{d.state}</span>
            </div>
            {d.score != null && (
              <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                d.score >= 60 ? 'bg-emerald-900/40 text-emerald-300'
                  : d.score >= 40 ? 'bg-amber-900/40 text-amber-300'
                  : 'bg-rose-900/40 text-rose-300'
              }`}>
                {d.score.toFixed(1)}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="ml-2 text-xs text-slate-400">Loading {districtName}…</span>
      </div>
    );
  }

  if (!detail) {
    return <p className="py-8 text-center text-sm text-slate-500">Could not load district data.</p>;
  }

  const statusColor = (s: string | null) => {
    if (!s) return 'bg-slate-700 text-slate-300';
    if (s === 'completed') return 'bg-emerald-900/60 text-emerald-300';
    if (s === 'in_progress') return 'bg-amber-900/60 text-amber-300';
    return 'bg-sky-900/60 text-sky-300';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-white">{detail.name}</h3>
          <span className="text-xs text-slate-400">{detail.state}</span>
          {detail.dataset_version && (
            <span className="ml-auto rounded-md bg-indigo-900/40 px-1.5 py-0.5 text-[0.6rem] font-medium text-indigo-300">
              {detail.dataset_version}
            </span>
          )}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-400">
          <span>Pop: <strong className="text-slate-200">{detail.population?.toLocaleString() ?? 'N/A'}</strong></span>
          <span>Area: <strong className="text-slate-200">{detail.area_sq_km?.toLocaleString() ?? 'N/A'}</strong> km²</span>
        </div>
      </div>

      {/* Crime Summary */}
      {detail.crime_summary.length > 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>▦</span> Crime Summary
          </h4>
          <div className="space-y-2">
            {detail.crime_summary.map((row, i) => {
              const rate = row.total_registered
                ? ((row.total_convicted / row.total_registered) * 100)
                : 0;
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">{row.year}</span>
                  <div className="flex gap-4">
                    <span className="text-slate-400">Reg: <strong className="text-slate-200">{row.total_registered?.toLocaleString()}</strong></span>
                    <span className="text-slate-400">Conv: <strong className="text-slate-200">{row.total_convicted?.toLocaleString()}</strong></span>
                    <span className={`font-semibold ${rate > 50 ? 'text-emerald-400' : rate > 25 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Infrastructure */}
      {detail.infra_summary.length > 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>⬡</span> Infrastructure Projects
          </h4>
          <div className="space-y-2">
            {detail.infra_summary.map((proj) => (
              <div key={proj.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
                <span className="text-xs font-medium text-slate-200">{proj.project_name}</span>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${statusColor(proj.status)}`}>
                    {proj.status?.replace('_', ' ') ?? '—'}
                  </span>
                  <span className="text-xs font-bold text-indigo-300">{proj.completion_pct ?? 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
