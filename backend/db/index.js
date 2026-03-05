'use strict';

const { Pool } = require('pg');
const { logger } = require('../lib/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

const SLOW_QUERY_THRESHOLD_MS = 1000;

async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn({ duration, query: text.substring(0, 200) }, 'Slow query detected');
    }
    return result;
  } catch (err) {
    logger.error({ err, query: text.substring(0, 200) }, 'Query failed');
    throw err;
  }
}

module.exports = { query, pool };
