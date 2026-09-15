'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../lib/logger');
const { validate } = require('../middleware/validate');
const { NotFoundError, ValidationError } = require('../lib/errors');

const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, '..', 'cache', 'static');

const districtsQuerySchema = {
  query: {
    state: { type: 'string', maxLength: 100, optional: true },
    dataset_version: { type: 'string', maxLength: 50, optional: true },
  },
};

// GET /api/districts — lightweight list without geometry
router.get('/', validate(districtsQuerySchema), async (req, res, next) => {
  try {
    const { state, dataset_version } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (state) {
      conditions.push(`state_normalized = $${paramIndex}`);
      params.push(state.toLowerCase().trim());
      paramIndex++;
    }

    if (dataset_version) {
      conditions.push(`dataset_version = $${paramIndex}`);
      params.push(dataset_version);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT id, name, state, census_code, population, area_sq_km,
              dataset_source, dataset_version, ingested_at
       FROM districts ${where} ORDER BY state, name`,
      params
    );

    res.json({ districts: result.rows, count: result.rowCount });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch districts');
    next(err);
  }
});

// GET /api/districts/topojson — serve cached TopoJSON with ETag and 304 support
router.get('/topojson', (req, res, next) => {
  try {
    const filePath = path.join(CACHE_DIR, 'india-districts.topojson');

    if (!fs.existsSync(filePath)) {
      return next(new NotFoundError('TopoJSON cache not generated. Run: make cache'));
    }

    const stat = fs.statSync(filePath);
    const etag = `W/"${stat.size}-${stat.mtime.getTime()}"`;

    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Content-Type', 'application/json');
    res.set('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.sendFile(path.resolve(filePath));
  } catch (err) {
    logger.error({ err }, 'Failed to serve TopoJSON');
    next(err);
  }
});

// GET /api/districts/:id — single district with geometry and related data
router.get('/:id', async (req, res, next) => {
  try {
    const districtId = parseInt(req.params.id, 10);
    if (isNaN(districtId) || districtId <= 0) {
      return next(new ValidationError('Invalid district ID'));
    }

    const district = await db.query(
      `SELECT id, name, state, census_code, population, area_sq_km,
              ST_AsGeoJSON(geom)::json AS geometry,
              dataset_source, dataset_version, ingested_at
       FROM districts WHERE id = $1`,
      [districtId]
    );

    if (district.rows.length === 0) {
      return next(new NotFoundError('District not found'));
    }

    const [crime, infra] = await Promise.all([
      db.query(
        `SELECT year, SUM(cases_registered) AS total_registered,
                SUM(cases_convicted) AS total_convicted
         FROM crime_stats WHERE district_id = $1
         GROUP BY year ORDER BY year DESC`,
        [districtId]
      ),
      db.query(
        `SELECT id, project_name, scheme, type, status, sanctioned_cost, completion_pct, year
         FROM infrastructure_projects WHERE district_id = $1
         ORDER BY year DESC NULLS LAST`,
        [districtId]
      ),
    ]);

    res.json({
      ...district.rows[0],
      crime_summary: crime.rows,
      infra_summary: infra.rows,
    });
  } catch (err) {
    logger.error({ err, districtId: req.params.id }, 'Failed to fetch district');
    next(err);
  }
});

module.exports = router;
