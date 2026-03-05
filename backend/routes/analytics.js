'use strict';

const express = require('express');
const router = express.Router();
const { logger } = require('../lib/logger');
const analytics = require('../services/analytics');

// GET /api/analytics/judicial-delay
router.get('/judicial-delay', async (req, res, next) => {
  try {
    const { year_from, year_to, dataset_version } = req.query;
    const result = await analytics.getJudicialDelay({ year_from, year_to, dataset_version });
    res.json({
      years: result,
      metadata: {
        dataset_version: dataset_version || 'latest',
        computed_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error({ err, query: req.query }, 'Failed to compute judicial delay');
    next(err);
  }
});

// GET /api/analytics/crime-vs-justice
router.get('/crime-vs-justice', async (req, res, next) => {
  try {
    const { state, year, dataset_version } = req.query;
    const result = await analytics.getCrimeVsJustice({ state, year, dataset_version });
    res.json({
      districts: result,
      metadata: {
        dataset_version: dataset_version || 'latest',
        computed_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error({ err, query: req.query }, 'Failed to compute crime vs justice');
    next(err);
  }
});

// GET /api/analytics/district-score
router.get('/district-score', async (req, res, next) => {
  try {
    const { year, state, dataset_version } = req.query;
    const result = await analytics.getDistrictScore({ year, state, dataset_version });
    res.json({
      districts: result,
      metadata: {
        dataset_version: dataset_version || 'latest',
        computed_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error({ err, query: req.query }, 'Failed to compute district scores');
    next(err);
  }
});

module.exports = router;
