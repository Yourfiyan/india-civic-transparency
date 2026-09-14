'use strict';

const { ValidationError } = require('../lib/errors');

/**
 * Validates request query/params/body against rules.
 * Rules object shape:
 * {
 *   query: {
 *     paramName: { type: 'int' | 'string' | 'enum', min, max, enumValues, optional: true }
 *   }
 * }
 */
function validate(schema) {
  return (req, _res, next) => {
    const errors = [];

    for (const [location, fields] of Object.entries(schema)) {
      const source = req[location] || {};

      for (const [field, rules] of Object.entries(fields)) {
        const val = source[field];

        if (val === undefined || val === null || val === '') {
          if (!rules.optional) {
            errors.push({ field, message: `${field} is required` });
          }
          continue;
        }

        if (rules.type === 'int') {
          const parsed = Number(val);
          if (!Number.isInteger(parsed) || isNaN(parsed)) {
            errors.push({ field, message: `${field} must be an integer` });
            continue;
          }
          if (rules.min !== undefined && parsed < rules.min) {
            errors.push({ field, message: `${field} must be at least ${rules.min}` });
          }
          if (rules.max !== undefined && parsed > rules.max) {
            errors.push({ field, message: `${field} must be at most ${rules.max}` });
          }
        } else if (rules.type === 'string') {
          if (typeof val !== 'string') {
            errors.push({ field, message: `${field} must be a string` });
            continue;
          }
          if (rules.minLength && val.trim().length < rules.minLength) {
            errors.push({ field, message: `${field} length must be at least ${rules.minLength}` });
          }
          if (rules.maxLength && val.length > rules.maxLength) {
            errors.push({ field, message: `${field} length must be at most ${rules.maxLength}` });
          }
        } else if (rules.type === 'enum') {
          if (!rules.enumValues.includes(val)) {
            errors.push({ field, message: `${field} must be one of: ${rules.enumValues.join(', ')}` });
          }
        }
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError('Invalid request parameters', errors));
    }

    next();
  };
}

module.exports = { validate };
