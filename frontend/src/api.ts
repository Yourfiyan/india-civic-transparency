import type {
  District,
  DistrictDetail,
  SupremeCase,
  CrimeSummaryRow,
  JudicialDelayRow,
  CrimeVsJusticeRow,
  DistrictScoreRow,
  DatasetInfo,
  InfraRow,
} from './types';

const BASE = '/api';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

/* ---------- districts ---------- */

export function getDistricts(state?: string, version?: string) {
  return fetchJson<{ districts: District[]; count: number }>(
    `${BASE}/districts${qs({ state, dataset_version: version })}`
  );
}

export function getDistrictTopojson(): Promise<Response> {
  return fetch(`${BASE}/districts/topojson`);
}

export function getDistrictDetail(id: number) {
  return fetchJson<DistrictDetail>(`${BASE}/districts/${id}`);
}

/* ---------- cases ---------- */

export function getCases(params: {
  q?: string;
  judge?: string;
  year_from?: number;
  year_to?: number;
  limit?: number;
  offset?: number;
  dataset_version?: string;
}) {
  return fetchJson<{ cases: SupremeCase[]; count: number }>(
    `${BASE}/cases${qs(params)}`
  );
}

export function getCaseById(id: string) {
  return fetchJson<SupremeCase>(`${BASE}/cases/${encodeURIComponent(id)}`);
}

/* ---------- crime ---------- */

export function getCrimeSummary(state?: string, year?: number, version?: string) {
  return fetchJson<{ summary: CrimeSummaryRow[] }>(
    `${BASE}/crime/summary${qs({ state, year, dataset_version: version })}`
  );
}

/* ---------- infrastructure ---------- */

export function getInfrastructure(params: {
  district_id?: number;
  scheme?: string;
  status?: string;
  year?: number;
  dataset_version?: string;
  limit?: number;
  offset?: number;
}) {
  return fetchJson<{ projects: InfraRow[]; count: number }>(
    `${BASE}/infrastructure${qs(params)}`
  );
}

/* ---------- analytics ---------- */

export function getJudicialDelay(version?: string) {
  return fetchJson<{ years: JudicialDelayRow[]; metadata: { dataset_version: string | null; computed_at: string } }>(
    `${BASE}/analytics/judicial-delay${qs({ dataset_version: version })}`
  );
}

export function getCrimeVsJustice(params?: {
  state?: string;
  year?: number;
  dataset_version?: string;
}) {
  return fetchJson<{ districts: CrimeVsJusticeRow[]; metadata: { dataset_version: string | null; computed_at: string } }>(
    `${BASE}/analytics/crime-vs-justice${qs(params ?? {})}`
  );
}

export function getDistrictScores(version?: string) {
  return fetchJson<{ districts: DistrictScoreRow[]; metadata: { dataset_version: string | null; computed_at: string } }>(
    `${BASE}/analytics/district-score${qs({ dataset_version: version })}`
  );
}

/* ---------- datasets ---------- */

export function getDatasets() {
  return fetchJson<{ datasets: DatasetInfo[] }>(`${BASE}/datasets`);
}
