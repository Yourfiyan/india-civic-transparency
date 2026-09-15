'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../lib/logger');
const { validate } = require('../middleware/validate');
const { NotFoundError } = require('../lib/errors');

const casesQuerySchema = {
  query: {
    q: { type: 'string', maxLength: 200, optional: true },
    judge: { type: 'string', maxLength: 100, optional: true },
    year_from: { type: 'int', min: 1950, max: 2100, optional: true },
    year_to: { type: 'int', min: 1950, max: 2100, optional: true },
    limit: { type: 'int', min: 1, max: 200, optional: true },
    offset: { type: 'int', min: 0, optional: true },
    dataset_version: { type: 'string', maxLength: 50, optional: true },
  },
};

// GET /api/cases — paginated list with full-text search
router.get('/', validate(casesQuerySchema), async (req, res, next) => {
  try {
    const { q, judge, year_from, year_to, dataset_version, limit = 50, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(petitioner, '') || ' ' || COALESCE(respondent, '') || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $${paramIndex})`);
      params.push(q);
      paramIndex++;
    }

    if (judge) {
      conditions.push(`judge ILIKE $${paramIndex}`);
      params.push(`%${judge}%`);
      paramIndex++;
    }

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

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitVal = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetVal = parseInt(offset, 10) || 0;

    params.push(limitVal, offsetVal);

    const sql = `
      SELECT case_id, title, petitioner, respondent, judge, bench_strength,
             date_filed, decision_date, citation, court, disposal_duration_days,
             dataset_source, dataset_version, ingested_at
      FROM supreme_cases
      ${where}
      ORDER BY decision_date DESC NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countSql = `SELECT COUNT(*) FROM supreme_cases ${where}`;
    const countParams = params.slice(0, -2);

    const [result, countResult] = await Promise.all([
      db.query(sql, params),
      db.query(countSql, countParams),
    ]);

    res.json({ cases: result.rows, count: parseInt(countResult.rows[0].count, 10) });
  } catch (err) {
    logger.error({ err, query: req.query }, 'Failed to fetch cases');
    next(err);
  }
});

// GET /api/cases/:id — single case
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT * FROM supreme_cases WHERE case_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return next(new NotFoundError('Case not found'));
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err, caseId: req.params.id }, 'Failed to fetch case');
    next(err);
  }
});

module.exports = router;
