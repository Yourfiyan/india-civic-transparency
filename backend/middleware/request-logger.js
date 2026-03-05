'use strict';

const { logger } = require('../lib/logger');

function requestLogger(req, res, next) {
  // Skip health checks to reduce noise
  if (req.path === '/api/health') {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.get('content-length'),
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'Request completed with server error');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'Request completed with client error');
    } else {
      logger.info(logData, 'Request completed');
    }
  });

  next();
}

module.exports = { requestLogger };
