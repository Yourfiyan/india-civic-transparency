'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../lib/logger');

// GET /api/infrastructure/geo — projects with district centroids
router.get('/geo', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT ip.id, ip.project_name, ip.scheme, ip.status,
              ip.sanctioned_cost, ip.completion_pct, ip.year,
              d.id AS district_id, d.name AS district_name, d.state,
              ST_X(ST_Centroid(d.geom)) AS lng,
              ST_Y(ST_Centroid(d.geom)) AS lat
       FROM infrastructure_projects ip
       JOIN districts d ON d.id = ip.district_id
       WHERE d.geom IS NOT NULL
       ORDER BY d.name, ip.year DESC`
    );
    res.json({ projects: result.rows });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch infrastructure geo data');
    next(err);
  }
});

// GET /api/infrastructure — filtered list
router.get('/', async (req, res, next) => {
  try {
    const { district_id, scheme, status, year, dataset_version, limit = 100, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (district_id) {
      conditions.push(`ip.district_id = $${paramIndex}`);
      params.push(parseInt(district_id, 10));
      paramIndex++;
    }

    if (scheme) {
      conditions.push(`ip.scheme = $${paramIndex}`);
      params.push(scheme);
      paramIndex++;
    }

    if (status) {
      conditions.push(`ip.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (year) {
      conditions.push(`ip.year = $${paramIndex}`);
      params.push(parseInt(year, 10));
      paramIndex++;
    }

    if (dataset_version) {
      conditions.push(`ip.dataset_version = $${paramIndex}`);
      params.push(dataset_version);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitVal = Math.min(parseInt(limit, 10) || 100, 500);
    const offsetVal = parseInt(offset, 10) || 0;

    params.push(limitVal, offsetVal);

    const result = await db.query(
      `SELECT ip.id, ip.district_id, d.name AS district_name, d.state,
              ip.project_name, ip.scheme, ip.type, ip.status,
              ip.sanctioned_cost, ip.completion_pct, ip.year,
              ip.dataset_source, ip.dataset_version, ip.ingested_at
       FROM infrastructure_projects ip
       LEFT JOIN districts d ON d.id = ip.district_id
       ${where}
       ORDER BY ip.year DESC, d.state, d.name
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({ projects: result.rows, count: result.rowCount });
  } catch (err) {
    logger.error({ err, query: req.query }, 'Failed to fetch infrastructure');
    next(err);
  }
});

module.exports = router;
