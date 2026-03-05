'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../lib/logger');

// GET /api/datasets — list all ingested datasets
router.get('/', async (_req, res, next) => {
  try {
    const result = await db.query(
      `SELECT dataset_name, dataset_source, dataset_version, ingested_at,
              record_count, status
       FROM dataset_ingestion_log
       ORDER BY ingested_at DESC`
    );
    res.json({ datasets: result.rows });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch datasets');
    next(err);
  }
});

// GET /api/datasets/:name — version history for a specific dataset
router.get('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const result = await db.query(
      `SELECT dataset_version, dataset_source, ingested_at, record_count, status, metadata
       FROM dataset_ingestion_log
       WHERE dataset_name = $1
       ORDER BY ingested_at DESC`,
      [name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `No ingestion records for dataset: ${name}` });
    }

    res.json({ name, versions: result.rows });
  } catch (err) {
    logger.error({ err, dataset: req.params.name }, 'Failed to fetch dataset versions');
    next(err);
  }
});

module.exports = router;
