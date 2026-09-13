'use strict';

/**
 * Lightweight, zero-dependency sliding window rate limiter middleware.
 * Tracks requests per IP address.
 */
function rateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const max = options.max || 120; // 120 requests per window
  const message = options.message || 'Too many requests, please try again later.';

  const hits = new Map();

  // Periodic cleanup
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of hits.entries()) {
      if (now - data.resetTime > windowMs) {
        hits.delete(ip);
      }
    }
  }, windowMs);

  if (timer.unref) timer.unref();

  return (req, res, next) => {
    // Skip health checks
    if (req.path === '/api/health') return next();

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = hits.get(ip);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(ip, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      return res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    next();
  };
}

module.exports = { rateLimiter };
