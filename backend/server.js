'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { logger } = require('./lib/logger');
const { requestLogger } = require('./middleware/request-logger');
const { pool } = require('./db');

const casesRouter = require('./routes/cases');
const districtsRouter = require('./routes/districts');
const crimeRouter = require('./routes/crime');
const infrastructureRouter = require('./routes/infrastructure');
const analyticsRouter = require('./routes/analytics');
const datasetsRouter = require('./routes/datasets');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, 'cache', 'static');

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Static cache files (TopoJSON)
app.use('/cache', express.static(CACHE_DIR, {
  maxAge: '1d',
  setHeaders(res) {
    res.set('Cache-Control', 'public, max-age=86400');
  },
}));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/cases', casesRouter);
app.use('/api/districts', districtsRouter);
app.use('/api/crime', crimeRouter);
app.use('/api/infrastructure', infrastructureRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/datasets', datasetsRouter);

// Global error handler
app.use((err, req, res, _next) => {
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled request error');
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info({ port: PORT, nodeEnv: process.env.NODE_ENV, logLevel: process.env.LOG_LEVEL || 'info' }, 'Server started');
});

// Graceful shutdown
function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(() => {
    pool.end().then(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection');
});

module.exports = app;
