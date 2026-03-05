'use strict';

const path = require('path');
const pino = require('pino');

const logLevel = process.env.LOG_LEVEL || 'info';
const logDir = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');
const logFile = path.join(logDir, 'backend.log');
const isDev = process.env.NODE_ENV !== 'production';

const targets = [
  {
    target: 'pino/file',
    options: { destination: logFile, mkdir: true },
    level: logLevel,
  },
];

if (isDev) {
  targets.push({
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
    level: logLevel,
  });
} else {
  targets.push({
    target: 'pino/file',
    options: { destination: 1 }, // stdout
    level: logLevel,
  });
}

const logger = pino({
  level: logLevel,
  base: { service: 'civic-backend', pid: process.pid },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: { targets },
});

module.exports = { logger };
