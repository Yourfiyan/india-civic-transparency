import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('India Civic Transparency API Integration Tests', () => {
  describe('Security Headers & Rate Limiting', () => {
    it('returns OWASP security headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers).toHaveProperty('content-security-policy');
    });

    it('returns rate limit headers', async () => {
      const res = await request(app).get('/api/districts');
      expect(res.headers).toHaveProperty('x-ratelimit-limit');
      expect(res.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Input Validation & Error Taxonomy', () => {
    it('rejects invalid integer query parameters with 400 and VALIDATION_ERROR code', async () => {
      const res = await request(app).get('/api/cases?year_from=invalid-year');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body).toHaveProperty('details');
      expect(res.body.details[0].field).toBe('year_from');
    });

    it('rejects out-of-range limit parameter with 400', async () => {
      const res = await request(app).get('/api/cases?limit=999');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid enum values for infrastructure status', async () => {
      const res = await request(app).get('/api/infrastructure?status=not-a-valid-status');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 with ROUTE_NOT_FOUND for non-existent API endpoints', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    });
  });

  describe('GET /api/cases', () => {
    it('returns paginated cases list and count', async () => {
      const res = await request(app).get('/api/cases?limit=5&offset=0');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('cases');
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.cases)).toBe(true);
      expect(res.body.cases.length).toBeLessThanOrEqual(5);
    });

    it('filters cases by search query', async () => {
      const res = await request(app).get('/api/cases?q=dance');
      expect(res.status).toBe(200);
      expect(res.body.cases.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for non-existent case id', async () => {
      const res = await request(app).get('/api/cases/NON-EXISTENT-ID');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('code', 'NOT_FOUND');
    });
  });

  describe('GET /api/districts', () => {
    it('returns districts array and count', async () => {
      const res = await request(app).get('/api/districts');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('districts');
      expect(res.body).toHaveProperty('count');
      expect(res.body.count).toBeGreaterThan(0);
    });

    it('serves cached TopoJSON with ETag and supports conditional 304 response', async () => {
      const res1 = await request(app).get('/api/districts/topojson');
      expect(res1.status).toBe(200);
      expect(res1.headers).toHaveProperty('etag');

      const etag = res1.headers['etag'];
      const res2 = await request(app)
        .get('/api/districts/topojson')
        .set('If-None-Match', etag);
      expect(res2.status).toBe(304);
    });

    it('returns district detail with geometry and stats for valid id', async () => {
      const districtsRes = await request(app).get('/api/districts?limit=1');
      const firstId = districtsRes.body.districts[0].id;
      const res = await request(app).get(`/api/districts/${firstId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', firstId);
      expect(res.body).toHaveProperty('crime_summary');
      expect(res.body).toHaveProperty('infra_summary');
    });

    it('rejects non-integer district ID with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/districts/abc');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/crime', () => {
    it('returns crime statistics and count', async () => {
      const res = await request(app).get('/api/crime?limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('crime_stats');
      expect(res.body).toHaveProperty('count');
    });

    it('returns geo aggregation with coordinates', async () => {
      const res = await request(app).get('/api/crime/geo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('districts');
      expect(Array.isArray(res.body.districts)).toBe(true);
      expect(res.body.districts[0]).toHaveProperty('lat');
      expect(res.body.districts[0]).toHaveProperty('lng');
    });

    it('returns state and year summary', async () => {
      const res = await request(app).get('/api/crime/summary');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
    });
  });

  describe('GET /api/infrastructure', () => {
    it('returns infrastructure list with valid filters', async () => {
      const res = await request(app).get('/api/infrastructure?status=completed&limit=5');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('projects');
      expect(res.body.projects.every((p) => p.status === 'completed')).toBe(true);
    });

    it('returns geo projects with centroids', async () => {
      const res = await request(app).get('/api/infrastructure/geo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('projects');
      expect(res.body.projects[0]).toHaveProperty('lat');
      expect(res.body.projects[0]).toHaveProperty('lng');
    });
  });

  describe('GET /api/analytics', () => {
    it('returns judicial delay analytics', async () => {
      const res = await request(app).get('/api/analytics/judicial-delay');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('years');
      expect(res.body).toHaveProperty('metadata');
    });

    it('returns crime vs justice metrics', async () => {
      const res = await request(app).get('/api/analytics/crime-vs-justice');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('districts');
    });

    it('returns composite district scores', async () => {
      const res = await request(app).get('/api/analytics/district-score');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('districts');
    });
  });

  describe('GET /api/datasets', () => {
    it('returns audit log of ingested datasets', async () => {
      const res = await request(app).get('/api/datasets');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('datasets');
      expect(res.body.datasets.length).toBeGreaterThan(0);
    });
  });
});
