import { useEffect, useState } from 'react';
import { getDistrictDetail } from '../api';
import type { DistrictDetail } from '../types';

interface InfoPanelProps {
  districtId: number | null;
  districtName: string;
}

export default function InfoPanel({ districtId, districtName }: InfoPanelProps) {
  const [detail, setDetail] = useState<DistrictDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!districtId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    getDistrictDetail(districtId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [districtId]);

  if (!districtId) {
    return (
      <div className="loading">Click a district on the map to view details.</div>
    );
  }

  if (loading) {
    return <div className="loading">Loading {districtName}…</div>;
  }

  if (!detail) {
    return <div className="loading">Could not load district data.</div>;
  }

  const statusBadge = (s: string | null) => {
    if (!s) return null;
    const cls =
      s === 'completed'
        ? 'badge-green'
        : s === 'in_progress'
        ? 'badge-yellow'
        : 'badge-blue';
    return <span className={`badge ${cls}`}>{s.replace('_', ' ')}</span>;
  };

  return (
    <div>
      <div className="panel-card">
        <h3>
          {detail.name}, {detail.state}
          {detail.dataset_version && (
            <span className="version-badge">{detail.dataset_version}</span>
          )}
        </h3>
        <p>
          Population: {detail.population?.toLocaleString() ?? 'N/A'} &middot;
          Area: {detail.area_sq_km?.toLocaleString() ?? 'N/A'} km²
        </p>
      </div>

      {detail.crime_summary.length > 0 && (
        <div className="panel-card info-section">
          <h4>Crime Summary</h4>
          {detail.crime_summary.map((row, i) => (
            <div key={i} className="stat-row">
              <span className="stat-label">{row.year}</span>
              <span>Reg: {row.total_registered?.toLocaleString()}</span>
              <span>Conv: {row.total_convicted?.toLocaleString()}</span>
              <span className="stat-value">
                {row.total_registered ? ((row.total_convicted / row.total_registered) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
          ))}
        </div>
      )}

      {detail.infra_summary.length > 0 && (
        <div className="panel-card info-section">
          <h4>Infrastructure Projects</h4>
          {detail.infra_summary.map((proj) => (
            <div key={proj.id} className="stat-row">
              <span className="stat-label">{proj.project_name}</span>
              <span>{statusBadge(proj.status)}</span>
              <span className="stat-value">{proj.completion_pct ?? 0}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
