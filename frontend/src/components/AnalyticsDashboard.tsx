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
      getJudicialDelay(v)
        .then((r) => setDelayData(r.years))
        .catch(() => setDelayData([]))
        .finally(() => setLoading(false));
    } else if (tab === 'crime') {
      getCrimeVsJustice({ dataset_version: v })
        .then((r) => setCrimeData(r.districts))
        .catch(() => setCrimeData([]))
        .finally(() => setLoading(false));
    } else {
      getDistrictScores(v)
        .then((r) => setScoreData(r.districts))
        .catch(() => setScoreData([]))
        .finally(() => setLoading(false));
    }
  }, [tab, version]);

  const maxVal = (arr: number[]) => Math.max(...arr, 1);

  return (
    <div>
      <div style={{ marginBottom: 10, display: 'flex', gap: 6 }}>
        <input
          className="search-input"
          style={{ flex: 1, marginBottom: 0 }}
          placeholder="Filter by version…"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
      </div>

      <div className="tab-bar" style={{ marginBottom: 12 }}>
        {(['delay', 'crime', 'score'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'delay'
              ? 'Judicial Delay'
              : t === 'crime'
              ? 'Crime vs Justice'
              : 'District Scores'}
          </button>
        ))}
      </div>

      {loading && <p className="loading">Loading analytics…</p>}

      {/* ----- Judicial Delay ----- */}
      {!loading && tab === 'delay' && (
        <div className="analytics-grid">
          {delayData.length === 0 && (
            <p className="loading">No data available.</p>
          )}
          <div className="bar-chart">
            {delayData.map((row) => {
              const max = maxVal(delayData.map((d) => Number(d.avg_delay_days)));
              return (
                <div key={row.year} className="bar-row">
                  <span className="bar-label">{row.year}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(Number(row.avg_delay_days) / max) * 100}%`,
                        background: '#0984e3',
                      }}
                    />
                  </div>
                  <span className="bar-value">{Math.round(Number(row.avg_delay_days))}d</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ----- Crime vs Justice ----- */}
      {!loading && tab === 'crime' && (
        <div className="analytics-grid">
          {crimeData.length === 0 && (
            <p className="loading">No data available.</p>
          )}
          {crimeData.slice(0, 30).map((row, i) => (
            <div key={`${row.name}-${row.year}-${i}`} className="panel-card">
              <h3>
                {row.name}, {row.state}
                <span className="version-badge">{row.year}</span>
              </h3>
              <div className="stat-row">
                <span className="stat-label">Registered</span>
                <span className="stat-value">
                  {row.total_registered.toLocaleString()}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Convicted</span>
                <span className="stat-value">
                  {row.total_convicted.toLocaleString()}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Conviction Rate</span>
                <span className="stat-value">
                  {(row.conviction_rate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----- District Scores ----- */}
      {!loading && tab === 'score' && (
        <div className="analytics-grid">
          {scoreData.length === 0 && (
            <p className="loading">No data available.</p>
          )}
          {scoreData.map((row) => {
            const max = maxVal(scoreData.map((d) => Number(d.score)));
            return (
              <div key={row.district_id} className="panel-card">
                <h3>
                  {row.name}, {row.state}
                  <span className="version-badge">
                    {Number(row.score).toFixed(1)}
                  </span>
                </h3>
                <div className="bar-chart">
                  {(
                    [
                      ['Crime Safety', Number(row.crime_safety), '#00b894'],
                      ['Justice Eff.', Number(row.justice_efficiency), '#0984e3'],
                      ['Infra Progress', Number(row.infra_progress), '#fdcb6e'],
                      ['Judicial Access', Number(row.judicial_access), '#e17055'],
                    ] as [string, number, string][]
                  ).map(([label, val, color]) => (
                    <div key={label} className="bar-row">
                      <span className="bar-label">{label}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${(val / 25) * 100}%`,
                            background: color,
                          }}
                        />
                      </div>
                      <span className="bar-value">{val.toFixed(1)}</span>
                    </div>
                  ))}
                  <div className="bar-row">
                    <span className="bar-label">Composite</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${(Number(row.score) / max) * 100}%`,
                          background: '#6c5ce7',
                        }}
                      />
                    </div>
                    <span className="bar-value">
                      {Number(row.score).toFixed(1)}
                    </span>
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
