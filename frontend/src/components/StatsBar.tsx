import { useEffect, useState } from 'react';
import { getDistricts, getCases, getCrimeSummary, getDistrictScores } from '../api';

interface Stats {
  districts: number;
  cases: number;
  crimeRecords: number;
  avgScore: number | null;
  topDistrict: string | null;
}

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
          topDistrict: top ? `${top.name} (${Number(top.score).toFixed(1)})` : null,
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
      <div className="stats-bar stats-bar--error">
        <p>Could not load stats — is the backend running on :3000?</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="stats-bar">
        <p className="stats-loading">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="stats-bar">
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card__value">{stats.districts}</span>
          <span className="stat-card__label">Districts</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{stats.cases}</span>
          <span className="stat-card__label">Court Cases</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{stats.crimeRecords}</span>
          <span className="stat-card__label">Crime Summaries</span>
        </div>
        {stats.avgScore != null && (
          <div className="stat-card">
            <span className="stat-card__value">{stats.avgScore}</span>
            <span className="stat-card__label">Avg Composite Score</span>
          </div>
        )}
      </div>

      {stats.topDistrict && (
        <p className="stats-highlight">
          Top-scoring district: <strong>{stats.topDistrict}</strong>
        </p>
      )}

      <p className="stats-hint">
        Use the tabs above to explore cases, district details, and analytics.
        Click any district on the map.
      </p>
    </div>
  );
}
