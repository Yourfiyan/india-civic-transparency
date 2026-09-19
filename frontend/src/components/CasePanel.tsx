import { useState, useEffect, useCallback, useRef } from 'react';
import { getCases } from '../api';
import type { SupremeCase } from '../types';
import { exportToCsv, exportToJson } from '../utils/exportData';

const PAGE_SIZE = 10;

export default function CasePanel() {
  const [query, setQuery] = useState('');
  const [judge, setJudge] = useState('');
  const [yearFrom, setYearFrom] = useState<number | undefined>(undefined);
  const [yearTo, setYearTo] = useState<number | undefined>(undefined);
  const [cases, setCases] = useState<SupremeCase[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(
    async (q: string, jg: string, yf?: number, yt?: number, pg: number = 0) => {
      setLoading(true);
      try {
        const res = await getCases({
          q: q || undefined,
          judge: jg || undefined,
          year_from: yf,
          year_to: yt,
          limit: PAGE_SIZE,
          offset: pg * PAGE_SIZE,
        });
        setCases(res.cases);
        setTotalCount(res.count);
      } catch {
        setCases([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    search(query, judge, yearFrom, yearTo, page);
  }, [search, judge, yearFrom, yearTo, page]);

  const handleSearchInput = (value: string) => {
    setQuery(value);
    setPage(0);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(value, judge, yearFrom, yearTo, 0);
    }, 350);
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') exportToCsv('supreme-court-cases', cases);
    else exportToJson('supreme-court-cases', cases);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const showing = Math.min(page * PAGE_SIZE + cases.length, totalCount);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Supreme Court Cases</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="rounded bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-slate-300 hover:bg-slate-700"
          >
            {showFilters ? 'Hide Filters' : 'Filters'}
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={cases.length === 0}
            className="rounded bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={cases.length === 0}
            className="rounded bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            JSON
          </button>
        </div>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-2.5 text-sm text-slate-500">🔍</span>
        <input
          type="text"
          placeholder="Search cases by title, parties…"
          value={query}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
        />
      </div>

      {showFilters && (
        <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
          <div>
            <label className="text-[0.65rem] font-medium text-slate-400">Judge</label>
            <input
              type="text"
              placeholder="e.g. Radhakrishnan"
              value={judge}
              onChange={(e) => {
                setJudge(e.target.value);
                setPage(0);
              }}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[0.65rem] font-medium text-slate-400">Year From</label>
              <input
                type="number"
                placeholder="1950"
                value={yearFrom ?? ''}
                onChange={(e) => {
                  setYearFrom(e.target.value ? parseInt(e.target.value, 10) : undefined);
                  setPage(0);
                }}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[0.65rem] font-medium text-slate-400">Year To</label>
              <input
                type="number"
                placeholder="2026"
                value={yearTo ?? ''}
                onChange={(e) => {
                  setYearTo(e.target.value ? parseInt(e.target.value, 10) : undefined);
                  setPage(0);
                }}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {!loading && totalCount > 0 && (
        <p className="text-xs text-slate-500">
          Showing {page * PAGE_SIZE + 1}–{showing} of {totalCount} cases
        </p>
      )}

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
            <h3 className="text-sm font-semibold leading-snug text-slate-100">{c.title}</h3>
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
              {c.judge && (
                <p>
                  <span className="font-semibold text-slate-400">Judge:</span> {c.judge}
                </p>
              )}
              {c.petitioner && (
                <p>
                  <span className="font-semibold text-slate-400">Petitioner:</span> {c.petitioner}
                </p>
              )}
              {c.respondent && (
                <p>
                  <span className="font-semibold text-slate-400">Respondent:</span> {c.respondent}
                </p>
              )}
              {c.citation && (
                <p>
                  <span className="font-semibold text-slate-400">Citation:</span> {c.citation}
                </p>
              )}
              {c.description && <p className="mt-2 leading-relaxed text-slate-400">{c.description}</p>}
            </div>
          )}
        </div>
      ))}

      {/* Pagination controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
