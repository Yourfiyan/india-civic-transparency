'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../lib/logger');

// GET /api/cases — paginated list with full-text search
router.get('/', async (req, res, next) => {
  try {
    const { q, judge, year_from, year_to, dataset_version, limit = 50, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(petitioner, '') || ' ' || COALESCE(respondent, '')) @@ plainto_tsquery('english', $${paramIndex})`);
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

    const result = await db.query(sql, params);
    res.json({ cases: result.rows, count: result.rowCount });
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
      return res.status(404).json({ error: 'Case not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err, caseId: req.params.id }, 'Failed to fetch case');
    next(err);
  }
});

module.exports = router;
