'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../lib/logger');

// GET /api/crime — filtered crime statistics
router.get('/', async (req, res, next) => {
  try {
    const { district_id, year, category, dataset_version, limit = 100, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (district_id) {
      conditions.push(`cs.district_id = $${paramIndex}`);
      params.push(parseInt(district_id, 10));
      paramIndex++;
    }

    if (year) {
      conditions.push(`cs.year = $${paramIndex}`);
      params.push(parseInt(year, 10));
      paramIndex++;
    }

    if (category) {
      conditions.push(`cs.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (dataset_version) {
      conditions.push(`cs.dataset_version = $${paramIndex}`);
      params.push(dataset_version);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitVal = Math.min(parseInt(limit, 10) || 100, 500);
    const offsetVal = parseInt(offset, 10) || 0;

    params.push(limitVal, offsetVal);

    const result = await db.query(
      `SELECT cs.id, cs.district_id, d.name AS district_name, d.state,
              cs.year, cs.category, cs.cases_registered, cs.cases_charge_sheeted,
              cs.cases_convicted, cs.conviction_rate,
              cs.dataset_source, cs.dataset_version, cs.ingested_at
       FROM crime_stats cs
       JOIN districts d ON d.id = cs.district_id
       ${where}
       ORDER BY cs.year DESC, d.state, d.name
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({ crime_stats: result.rows, count: result.rowCount });
  } catch (err) {
    logger.error({ err, query: req.query }, 'Failed to fetch crime stats');
    next(err);
  }
});

// GET /api/crime/geo — aggregated crime counts with district centroids
router.get('/geo', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT d.id, d.name, d.state,
              ST_X(ST_Centroid(d.geom)) AS lng,
              ST_Y(ST_Centroid(d.geom)) AS lat,
              SUM(cs.cases_registered)::int AS total_cases,
              SUM(cs.cases_convicted)::int AS total_convicted
       FROM districts d
       JOIN crime_stats cs ON cs.district_id = d.id
       WHERE d.geom IS NOT NULL
       GROUP BY d.id, d.name, d.state
       ORDER BY total_cases DESC`
    );
    res.json({ districts: result.rows });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch crime geo data');
    next(err);
  }
});

// GET /api/crime/summary — aggregated by state and year
router.get('/summary', async (req, res, next) => {
  try {
    const { year, state, dataset_version } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (year) {
      conditions.push(`cs.year = $${paramIndex}`);
      params.push(parseInt(year, 10));
      paramIndex++;
    }

    if (state) {
      conditions.push(`d.state_normalized = $${paramIndex}`);
      params.push(state.toLowerCase().trim());
      paramIndex++;
    }

    if (dataset_version) {
      conditions.push(`cs.dataset_version = $${paramIndex}`);
      params.push(dataset_version);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT d.state, cs.year,
              SUM(cs.cases_registered) AS total_registered,
              SUM(cs.cases_convicted) AS total_convicted,
              CASE WHEN SUM(cs.cases_charge_sheeted) > 0
                   THEN ROUND(SUM(cs.cases_convicted)::numeric / SUM(cs.cases_charge_sheeted), 4)
                   ELSE NULL
              END AS conviction_rate
       FROM crime_stats cs
       JOIN districts d ON d.id = cs.district_id
       ${where}
       GROUP BY d.state, cs.year
       ORDER BY d.state, cs.year DESC`,
      params
    );

    res.json({ summary: result.rows });
  } catch (err) {
    logger.error({ err, query: req.query }, 'Failed to fetch crime summary');
    next(err);
  }
});

module.exports = router;
