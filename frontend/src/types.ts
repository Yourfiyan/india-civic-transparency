/* ---------- shared types ---------- */

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

export interface District {
  id: number;
  name: string;
  name_normalized: string;
  state: string;
  state_normalized: string;
  census_code: string | null;
  area_sq_km: number | null;
  population: number | null;
  dataset_version: string | null;
}

export interface DistrictCrimeSummary {
  year: number;
  total_registered: number;
  total_convicted: number;
}

export interface DistrictDetail extends District {
  geometry: GeoJsonGeometry | null;
  crime_summary: DistrictCrimeSummary[];
  infra_summary: InfraRow[];
}

export interface SupremeCase {
  case_id: string;
  title: string;
  petitioner: string | null;
  respondent: string | null;
  judge: string | null;
  bench_strength: number | null;
  date_filed: string | null;
  decision_date: string | null;
  citation: string | null;
  court: string | null;
  description: string | null;
  disposal_duration_days: number | null;
  dataset_version: string | null;
}

export interface CrimeStat {
  id: number;
  district_id: number;
  year: number;
  category: string;
  cases_registered: number;
  cases_charge_sheeted: number;
  cases_convicted: number;
  conviction_rate: number | null;
  dataset_version: string | null;
}

export interface CrimeSummaryRow {
  state: string;
  year: number;
  total_registered: number;
  total_convicted: number;
  conviction_rate: number;
}

export interface InfraRow {
  id: number;
  project_name: string;
  scheme: string | null;
  type: string | null;
  status: string | null;
  sanctioned_cost: number | null;
  completion_pct: number | null;
  year: number | null;
}

export interface JudicialDelayRow {
  year: number;
  case_count: number;
  avg_delay_days: number;
  median_delay_days: number;
}

export interface CrimeVsJusticeRow {
  name: string;
  state: string;
  year: number;
  total_registered: number;
  total_convicted: number;
  conviction_rate: number;
}

export interface DistrictScoreRow {
  district_id: number;
  name: string;
  state: string;
  score: number;
  crime_safety: number;
  justice_efficiency: number;
  infra_progress: number;
  judicial_access: number;
}

export interface DatasetInfo {
  id: number;
  dataset_name: string;
  dataset_source: string;
  dataset_version: string;
  ingested_at: string;
  record_count: number;
  status: string;
  metadata: Record<string, unknown> | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total?: number;
  };
}

export interface AnalyticsResponse<T> {
  data: T[];
  metadata: {
    dataset_version: string | null;
    computed_at: string;
  };
}
