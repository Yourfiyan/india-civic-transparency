'use strict';

const db = require('../db');

async function getJudicialDelay({ year_from, year_to, dataset_version }) {
  const conditions = ['disposal_duration_days IS NOT NULL', 'decision_date IS NOT NULL'];
  const params = [];
  let paramIndex = 1;

  if (year_from) {
    conditions.push(`EXTRACT(YEAR FROM decision_date) >= $${paramIndex}`);
    params.push(parseInt(year_from, 10));
    paramIndex++;
  }

  if (year_to) {
    conditions.push(`EXTRACT(YEAR FROM decision_date) <= $${paramIndex}`);
    params.push(parseInt(year_to, 10));
    paramIndex++;
  }

  if (dataset_version) {
    conditions.push(`dataset_version = $${paramIndex}`);
    params.push(dataset_version);
    paramIndex++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const result = await db.query(
    `SELECT
        EXTRACT(YEAR FROM decision_date)::INT AS year,
        COUNT(*) AS case_count,
        ROUND(AVG(disposal_duration_days)) AS avg_delay_days,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY disposal_duration_days)::numeric) AS median_delay_days
     FROM supreme_cases
     ${where}
     GROUP BY EXTRACT(YEAR FROM decision_date)
     ORDER BY year`,
    params
  );

  return result.rows;
}

async function getCrimeVsJustice({ state, year, dataset_version }) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (state) {
    conditions.push(`d.state_normalized = $${paramIndex}`);
    params.push(state.toLowerCase().trim());
    paramIndex++;
  }

  if (year) {
    conditions.push(`cs.year = $${paramIndex}`);
    params.push(parseInt(year, 10));
    paramIndex++;
  }

  if (dataset_version) {
    conditions.push(`cs.dataset_version = $${paramIndex}`);
    params.push(dataset_version);
    paramIndex++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT
        d.name, d.state,
        SUM(cs.cases_registered) AS total_registered,
        SUM(cs.cases_convicted) AS total_convicted,
        CASE WHEN SUM(cs.cases_charge_sheeted) > 0
             THEN ROUND(SUM(cs.cases_convicted)::numeric / SUM(cs.cases_charge_sheeted), 4)
             ELSE NULL
        END AS conviction_rate,
        cs.year
     FROM crime_stats cs
     JOIN districts d ON d.id = cs.district_id
     ${where}
     GROUP BY d.name, d.state, cs.year
     ORDER BY d.state, d.name`,
    params
  );

  return result.rows;
}

async function getDistrictScore({ year, state, dataset_version }) {
  const crimeConditions = [];
  const infraConditions = [];
  const params = [];
  let paramIndex = 1;

  if (year) {
    crimeConditions.push(`cs.year = $${paramIndex}`);
    infraConditions.push(`ip.year = $${paramIndex}`);
    params.push(parseInt(year, 10));
    paramIndex++;
  }

  if (dataset_version) {
    crimeConditions.push(`cs.dataset_version = $${paramIndex}`);
    infraConditions.push(`ip.dataset_version = $${paramIndex}`);
    params.push(dataset_version);
    paramIndex++;
  }

  const crimeWhere = crimeConditions.length > 0 ? `WHERE ${crimeConditions.join(' AND ')}` : '';
  const infraWhere = infraConditions.length > 0 ? `WHERE ${infraConditions.join(' AND ')}` : '';

  let stateFilter = '';
  if (state) {
    stateFilter = `WHERE d.state_normalized = $${paramIndex}`;
    params.push(state.toLowerCase().trim());
    paramIndex++;
  }

  const result = await db.query(
    `WITH crime_agg AS (
        SELECT cs.district_id,
               SUM(cs.cases_registered) AS total_crime,
               CASE WHEN SUM(cs.cases_charge_sheeted) > 0
                    THEN SUM(cs.cases_convicted)::numeric / SUM(cs.cases_charge_sheeted)
                    ELSE 0 END AS conviction_rate
        FROM crime_stats cs
        ${crimeWhere}
        GROUP BY cs.district_id
    ),
    infra_agg AS (
        SELECT ip.district_id, AVG(ip.completion_pct) AS avg_completion
        FROM infrastructure_projects ip
        ${infraWhere}
        GROUP BY ip.district_id
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
        d.id AS district_id, d.name, d.state,
        ROUND(
            COALESCE(CASE WHEN r.max_crime > r.min_crime
                 THEN (1.0 - (ca.total_crime - r.min_crime)::numeric / (r.max_crime - r.min_crime)) * 25
                 ELSE 12.5 END, 12.5) +
            COALESCE(CASE WHEN r.max_conv > r.min_conv
                 THEN ((ca.conviction_rate - r.min_conv) / (r.max_conv - r.min_conv)) * 25
                 ELSE 12.5 END, 12.5) +
            COALESCE(CASE WHEN r.max_infra > r.min_infra
                 THEN ((ia.avg_completion - r.min_infra) / (r.max_infra - r.min_infra)) * 25
                 ELSE 12.5 END, 12.5) +
            12.5
        , 1) AS score,
        ROUND(COALESCE(CASE WHEN r.max_crime > r.min_crime
             THEN (1.0 - (ca.total_crime - r.min_crime)::numeric / (r.max_crime - r.min_crime)) * 25
             ELSE 12.5 END, 12.5), 1) AS crime_safety,
        ROUND(COALESCE(CASE WHEN r.max_conv > r.min_conv
             THEN ((ca.conviction_rate - r.min_conv) / (r.max_conv - r.min_conv)) * 25
             ELSE 12.5 END, 12.5), 1) AS justice_efficiency,
        ROUND(COALESCE(CASE WHEN r.max_infra > r.min_infra
             THEN ((ia.avg_completion - r.min_infra) / (r.max_infra - r.min_infra)) * 25
             ELSE 12.5 END, 12.5), 1) AS infra_progress,
        12.5 AS judicial_access
    FROM districts d
    LEFT JOIN crime_agg ca ON ca.district_id = d.id
    LEFT JOIN infra_agg ia ON ia.district_id = d.id
    CROSS JOIN ranges r
    ${stateFilter}
    ORDER BY score DESC`,
    params
  );

  return result.rows;
}

module.exports = { getJudicialDelay, getCrimeVsJustice, getDistrictScore };
