-- India Civic Transparency Platform — Database Schema
-- Requires PostgreSQL 14+ with PostGIS extension

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- Dataset ingestion log — audit trail for all data imports
-- ============================================================
CREATE TABLE IF NOT EXISTS dataset_ingestion_log (
    id              SERIAL PRIMARY KEY,
    dataset_name    TEXT NOT NULL,
    dataset_source  TEXT NOT NULL,
    dataset_version TEXT NOT NULL,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_count    INT,
    status          TEXT NOT NULL DEFAULT 'completed',
    metadata        JSONB,
    UNIQUE(dataset_name, dataset_version)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_name_date
    ON dataset_ingestion_log (dataset_name, ingested_at DESC);

-- ============================================================
-- Districts
-- ============================================================
CREATE TABLE IF NOT EXISTS districts (
    id                SERIAL PRIMARY KEY,
    name              TEXT NOT NULL,
    name_normalized   TEXT NOT NULL,
    state             TEXT NOT NULL,
    state_normalized  TEXT NOT NULL,
    census_code       TEXT,
    geom              GEOMETRY(MultiPolygon, 4326),
    area_sq_km        NUMERIC,
    population        INT,
    dataset_source    TEXT DEFAULT 'datameet',
    dataset_version   TEXT,
    ingested_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name_normalized, state_normalized)
);

CREATE INDEX IF NOT EXISTS idx_districts_state ON districts (state_normalized);
CREATE INDEX IF NOT EXISTS idx_districts_geom ON districts USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_districts_version ON districts (dataset_version);

-- ============================================================
-- Supreme Court Cases
-- ============================================================
CREATE TABLE IF NOT EXISTS supreme_cases (
    case_id               TEXT PRIMARY KEY,
    title                 TEXT,
    petitioner            TEXT,
    respondent            TEXT,
    judge                 TEXT,
    bench_strength        INT,
    date_filed            DATE,
    decision_date         DATE,
    citation              TEXT,
    court                 TEXT,
    description           TEXT,
    disposal_duration_days INT,
    dataset_source        TEXT DEFAULT 's3://indian-supreme-court-judgments/',
    dataset_version       TEXT,
    ingested_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_decision_date ON supreme_cases (decision_date);
CREATE INDEX IF NOT EXISTS idx_cases_title_fts ON supreme_cases USING GIN (to_tsvector('english', COALESCE(title, '')));
CREATE INDEX IF NOT EXISTS idx_cases_version ON supreme_cases (dataset_version);

-- ============================================================
-- Crime Statistics
-- ============================================================
CREATE TABLE IF NOT EXISTS crime_stats (
    id                   SERIAL PRIMARY KEY,
    district_id          INT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    year                 INT NOT NULL,
    category             TEXT NOT NULL,
    cases_registered     INT,
    cases_charge_sheeted INT,
    cases_convicted      INT,
    conviction_rate      NUMERIC GENERATED ALWAYS AS (
        CASE WHEN cases_charge_sheeted > 0
             THEN cases_convicted::numeric / cases_charge_sheeted
             ELSE NULL
        END
    ) STORED,
    dataset_source       TEXT DEFAULT 'ncrb',
    dataset_version      TEXT,
    ingested_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(district_id, year, category)
);

CREATE INDEX IF NOT EXISTS idx_crime_district_year ON crime_stats (district_id, year);
CREATE INDEX IF NOT EXISTS idx_crime_category ON crime_stats (category);
CREATE INDEX IF NOT EXISTS idx_crime_version ON crime_stats (dataset_version);

-- ============================================================
-- Infrastructure Projects
-- ============================================================
CREATE TABLE IF NOT EXISTS infrastructure_projects (
    id               SERIAL PRIMARY KEY,
    district_id      INT REFERENCES districts(id) ON DELETE CASCADE,
    project_name     TEXT,
    scheme           TEXT,
    type             TEXT,
    status           TEXT,
    sanctioned_cost  NUMERIC,
    completion_pct   NUMERIC,
    year             INT,
    dataset_source   TEXT DEFAULT 'pmgsy',
    dataset_version  TEXT,
    ingested_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infra_district_year ON infrastructure_projects (district_id, year);
CREATE INDEX IF NOT EXISTS idx_infra_version ON infrastructure_projects (dataset_version);

-- ============================================================
-- Analytics Views
-- ============================================================

CREATE OR REPLACE VIEW v_judicial_delay AS
SELECT
    EXTRACT(YEAR FROM decision_date)::INT AS year,
    court,
    COUNT(*) AS case_count,
    ROUND(AVG(disposal_duration_days)) AS avg_delay_days,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY disposal_duration_days) AS median_delay_days
FROM supreme_cases
WHERE disposal_duration_days IS NOT NULL
  AND decision_date IS NOT NULL
GROUP BY EXTRACT(YEAR FROM decision_date), court;

CREATE OR REPLACE VIEW v_crime_summary AS
SELECT
    d.id AS district_id,
    d.name AS district_name,
    d.state,
    cs.year,
    SUM(cs.cases_registered) AS total_registered,
    SUM(cs.cases_convicted) AS total_convicted,
    CASE WHEN SUM(cs.cases_charge_sheeted) > 0
         THEN ROUND(SUM(cs.cases_convicted)::numeric / SUM(cs.cases_charge_sheeted), 4)
         ELSE NULL
    END AS conviction_rate
FROM crime_stats cs
JOIN districts d ON d.id = cs.district_id
GROUP BY d.id, d.name, d.state, cs.year;

CREATE OR REPLACE VIEW v_district_score AS
WITH crime_agg AS (
    SELECT
        district_id,
        SUM(cases_registered) AS total_crime,
        CASE WHEN SUM(cases_charge_sheeted) > 0
             THEN SUM(cases_convicted)::numeric / SUM(cases_charge_sheeted)
             ELSE 0
        END AS conviction_rate
    FROM crime_stats
    GROUP BY district_id
),
infra_agg AS (
    SELECT
        district_id,
        AVG(completion_pct) AS avg_completion
    FROM infrastructure_projects
    GROUP BY district_id
),
ranges AS (
    SELECT
        MIN(ca.total_crime) AS min_crime, MAX(ca.total_crime) AS max_crime,
        MIN(ca.conviction_rate) AS min_conv, MAX(ca.conviction_rate) AS max_conv,
        MIN(ia.avg_completion) AS min_infra, MAX(ia.avg_completion) AS max_infra
    FROM crime_agg ca
    LEFT JOIN infra_agg ia ON ia.district_id = ca.district_id
)
SELECT
    d.id AS district_id,
    d.name,
    d.state,
    ROUND(
        COALESCE(
            CASE WHEN r.max_crime > r.min_crime
                 THEN (1.0 - (ca.total_crime - r.min_crime)::numeric / (r.max_crime - r.min_crime)) * 25
                 ELSE 12.5
            END, 12.5
        ) +
        COALESCE(
            CASE WHEN r.max_conv > r.min_conv
                 THEN ((ca.conviction_rate - r.min_conv) / (r.max_conv - r.min_conv)) * 25
                 ELSE 12.5
            END, 12.5
        ) +
        COALESCE(
            CASE WHEN r.max_infra > r.min_infra
                 THEN ((ia.avg_completion - r.min_infra) / (r.max_infra - r.min_infra)) * 25
                 ELSE 12.5
            END, 12.5
        ) +
        12.5, -- judicial access placeholder (equal for all until state-level data linked)
    1) AS score,
    ROUND(COALESCE(
        CASE WHEN r.max_crime > r.min_crime
             THEN (1.0 - (ca.total_crime - r.min_crime)::numeric / (r.max_crime - r.min_crime)) * 25
             ELSE 12.5
        END, 12.5
    ), 1) AS crime_safety,
    ROUND(COALESCE(
        CASE WHEN r.max_conv > r.min_conv
             THEN ((ca.conviction_rate - r.min_conv) / (r.max_conv - r.min_conv)) * 25
             ELSE 12.5
        END, 12.5
    ), 1) AS justice_efficiency,
    ROUND(COALESCE(
        CASE WHEN r.max_infra > r.min_infra
             THEN ((ia.avg_completion - r.min_infra) / (r.max_infra - r.min_infra)) * 25
             ELSE 12.5
        END, 12.5
    ), 1) AS infra_progress,
    12.5 AS judicial_access
FROM districts d
LEFT JOIN crime_agg ca ON ca.district_id = d.id
LEFT JOIN infra_agg ia ON ia.district_id = d.id
CROSS JOIN ranges r;
