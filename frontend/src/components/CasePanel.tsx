import { useState, useEffect, useCallback, useRef } from 'react';
import { getCases } from '../api';
import type { SupremeCase } from '../types';

export default function CasePanel() {
  const [query, setQuery] = useState('');
  const [cases, setCases] = useState<SupremeCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await getCases({ q: q || undefined, limit: 50 });
      setCases(res.cases);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search('');
  }, [search]);

  const handleInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 350);
  };

  return (
    <div>
      <input
        className="search-input"
        type="text"
        placeholder="Search cases…"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
      />

      {loading && <p className="loading">Loading…</p>}

      {!loading && cases.length === 0 && (
        <p className="loading">No cases found.</p>
      )}

      {cases.map((c) => (
        <div
          key={c.case_id}
          className="panel-card"
          style={{ cursor: 'pointer' }}
          onClick={() =>
            setExpanded(expanded === c.case_id ? null : c.case_id)
          }
        >
          <h3>
            {c.title}
            {c.dataset_version && (
              <span className="version-badge">{c.dataset_version}</span>
            )}
          </h3>
          <p>
            {c.court} &middot; {c.decision_date ?? 'Pending'}
            {c.disposal_duration_days != null && (
              <> &middot; {c.disposal_duration_days} days</>
            )}
          </p>

          {expanded === c.case_id && (
            <div style={{ marginTop: 8 }}>
              {c.judge && <p><strong>Judge:</strong> {c.judge}</p>}
              {c.petitioner && (
                <p><strong>Petitioner:</strong> {c.petitioner}</p>
              )}
              {c.respondent && (
                <p><strong>Respondent:</strong> {c.respondent}</p>
              )}
              {c.citation && <p><strong>Citation:</strong> {c.citation}</p>}
              {c.description && (
                <p style={{ marginTop: 6 }}>{c.description}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
