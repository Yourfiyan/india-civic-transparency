import { useEffect, useState } from 'react';
import { getDistricts, getCases, getCrimeSummary, getDistrictScores } from '../api';

interface Stats {
  districts: number;
  cases: number;
  crimeRecords: number;
  avgScore: number | null;
  topDistrict: string | null;
  topScore: number | null;
}

const CARDS: {
  key: keyof Stats;
  label: string;
  icon: string;
  color: string;
}[] = [
  { key: 'districts', label: 'Districts', icon: '◎', color: 'from-indigo-600/20 to-indigo-600/5 border-indigo-500/20 text-indigo-400' },
  { key: 'cases', label: 'Supreme Court Cases', icon: '⚖', color: 'from-amber-600/20 to-amber-600/5 border-amber-500/20 text-amber-400' },
  { key: 'crimeRecords', label: 'Crime Registrations', icon: '▦', color: 'from-rose-600/20 to-rose-600/5 border-rose-500/20 text-rose-400' },
  { key: 'avgScore', label: 'Avg Score', icon: '★', color: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400' },
];

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dRes, cRes, crRes, sRes] = await Promise.all([
          getDistricts(),
          getCases({ limit: 1 }),
          getCrimeSummary(),
          getDistrictScores().catch(() => null),
        ]);
        if (cancelled) return;
        const scores = sRes?.districts ?? [];
        const top = scores.length
          ? scores.reduce((a, b) => (Number(b.score) > Number(a.score) ? b : a))
          : null;
        setStats({
          districts: dRes.count,
          cases: cRes.count,
          crimeRecords: crRes.summary.length,
          avgScore: scores.length
            ? Math.round((scores.reduce((s, r) => s + Number(r.score), 0) / scores.length) * 10) / 10
            : null,
          topDistrict: top?.name ?? null,
          topScore: top ? Number(top.score) : null,
        });
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-300">
        Could not load stats — is the backend running on :3000?
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="ml-3 text-sm text-slate-400">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {CARDS.map(({ key, label, icon, color }) => {
          const val = stats[key];
          if (val == null) return null;
          return (
            <div
              key={key}
              className={`group rounded-xl border bg-gradient-to-br p-4
                transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/5
                ${color}`}
            >
              <div className="mb-2 text-xl">{icon}</div>
              <div className="text-2xl font-extrabold tracking-tight text-white">
                {typeof val === 'number' ? val.toLocaleString() : val}
              </div>
              <div className="mt-1 text-[0.7rem] font-medium uppercase tracking-wider text-slate-400">
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {stats.topDistrict && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-4">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">🏆</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
              Top Scoring District
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-white">
            {stats.topDistrict}
            <span className="ml-2 text-sm font-medium text-emerald-400">
              {stats.topScore?.toFixed(1)}
            </span>
          </p>
        </div>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        Navigate using the sidebar to explore court cases, district details, and analytics.
        Click any district on the map for details.
      </p>
    </div>
  );
}
