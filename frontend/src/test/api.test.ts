import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDistricts,
  getDistrictDetail,
  getCases,
  getCaseById,
  getJudicialDelay,
  getCrimeVsJustice,
  getDistrictScores,
  getDatasets,
} from '../api';

describe('Frontend API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches districts with query parameters', async () => {
    const mockData = { districts: [{ id: 1, name: 'Mumbai' }], count: 1 };
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const res = await getDistricts('Maharashtra', 'seed-v1');
    expect(res).toEqual(mockData);
    expect((globalThis as any).fetch).toHaveBeenCalledWith('/api/districts?state=Maharashtra&dataset_version=seed-v1');
  });

  it('throws error when API returns non-ok response', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(getDistrictDetail(999)).rejects.toThrow('API 404: Not Found');
  });

  it('fetches cases with pagination and query', async () => {
    const mockCases = { cases: [], count: 0 };
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCases),
    });

    const res = await getCases({ q: 'dance bar', limit: 10, offset: 20 });
    expect(res).toEqual(mockCases);
    expect((globalThis as any).fetch).toHaveBeenCalledWith('/api/cases?q=dance+bar&limit=10&offset=20');
  });

  it('fetches case by ID with URL encoding', async () => {
    const mockCase = { case_id: 'SC/2020/01', title: 'Test Case' };
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCase),
    });

    const res = await getCaseById('SC/2020/01');
    expect(res).toEqual(mockCase);
    expect((globalThis as any).fetch).toHaveBeenCalledWith('/api/cases/SC%2F2020%2F01');
  });

  it('fetches analytics and dataset endpoints', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await getJudicialDelay('v1');
    expect((globalThis as any).fetch).toHaveBeenCalledWith('/api/analytics/judicial-delay?dataset_version=v1');

    await getCrimeVsJustice({ state: 'Delhi' });
    expect((globalThis as any).fetch).toHaveBeenCalledWith('/api/analytics/crime-vs-justice?state=Delhi');

    await getDistrictScores();
    expect((globalThis as any).fetch).toHaveBeenCalledWith('/api/analytics/district-score');

    await getDatasets();
    expect((globalThis as any).fetch).toHaveBeenCalledWith('/api/datasets');
  });
});
