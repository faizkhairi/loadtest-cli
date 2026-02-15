import { describe, it, expect } from 'vitest';
import { formatJsonReport } from '../src/reporter/json.js';
import type { LoadTestStats } from '../src/types.js';

const mockStats: LoadTestStats = {
  totalRequests: 100,
  successfulRequests: 95,
  failedRequests: 5,
  totalDuration: 2000,
  requestsPerSecond: 50,
  latency: { min: 5, max: 500, mean: 100, p50: 80, p95: 350, p99: 480 },
  statusCodes: { 200: 90, 404: 5 },
};

describe('formatJsonReport', () => {
  it('outputs valid JSON', () => {
    const json = formatJsonReport(mockStats, 'https://example.com');
    const parsed = JSON.parse(json);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.totalRequests).toBe(100);
    expect(parsed.timestamp).toBeDefined();
  });

  it('includes all stats fields', () => {
    const json = formatJsonReport(mockStats, 'https://api.test');
    const parsed = JSON.parse(json);
    expect(parsed.latency.p95).toBe(350);
    expect(parsed.statusCodes['200']).toBe(90);
    expect(parsed.requestsPerSecond).toBe(50);
  });
});
