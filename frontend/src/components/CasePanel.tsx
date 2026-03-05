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
    <div className="space-y-3">
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-sm text-slate-500">🔍</span>
        <input
          type="text"
          placeholder="Search cases…"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="ml-2 text-xs text-slate-400">Searching…</span>
        </div>
      )}

      {!loading && cases.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">No cases found.</p>
      )}

      {cases.map((c) => (
        <div
          key={c.case_id}
          onClick={() => setExpanded(expanded === c.case_id ? null : c.case_id)}
          className="cursor-pointer rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 transition-all duration-200 hover:border-indigo-500/30 hover:bg-slate-800/70"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-snug text-slate-100">
              {c.title}
            </h3>
            {c.dataset_version && (
              <span className="shrink-0 rounded-md bg-slate-700/60 px-1.5 py-0.5 text-[0.6rem] font-medium text-slate-400">
                {c.dataset_version}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            {c.court} · {c.decision_date ?? 'Pending'}
            {c.disposal_duration_days != null && (
              <span className="ml-1 text-indigo-400">· {c.disposal_duration_days} days</span>
            )}
          </p>

          {expanded === c.case_id && (
            <div className="mt-3 space-y-1.5 border-t border-slate-700/50 pt-3 text-xs text-slate-300">
              {c.judge && <p><span className="font-semibold text-slate-400">Judge:</span> {c.judge}</p>}
              {c.petitioner && <p><span className="font-semibold text-slate-400">Petitioner:</span> {c.petitioner}</p>}
              {c.respondent && <p><span className="font-semibold text-slate-400">Respondent:</span> {c.respondent}</p>}
              {c.citation && <p><span className="font-semibold text-slate-400">Citation:</span> {c.citation}</p>}
              {c.description && <p className="mt-2 leading-relaxed text-slate-400">{c.description}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
