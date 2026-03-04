import { describe, it, expect } from 'vitest';
import { calculateStats, percentile } from '../src/stats.js';
import type { RequestResult } from '../src/types.js';

describe('percentile', () => {
  it('returns 0 for empty array', () => {
    expect(percentile([], 50)).toBe(0);
  });

  it('returns the single element for a 1-element array', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 99)).toBe(42);
  });

  it('calculates p50 correctly', () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(sorted, 50)).toBe(50);
  });

  it('calculates p95 correctly', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 95)).toBe(95);
  });

  it('calculates p99 correctly', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 99)).toBe(99);
  });
});

describe('calculateStats', () => {
  it('calculates stats for successful requests', () => {
    const results: RequestResult[] = [
      { status: 200, latency: 10 },
      { status: 200, latency: 20 },
      { status: 200, latency: 30 },
      { status: 200, latency: 40 },
      { status: 200, latency: 50 },
    ];

    const stats = calculateStats(results, 1000);

    expect(stats.totalRequests).toBe(5);
    expect(stats.successfulRequests).toBe(5);
    expect(stats.failedRequests).toBe(0);
    expect(stats.assertionFailures).toBe(0);
    expect(stats.totalDuration).toBe(1000);
    expect(stats.requestsPerSecond).toBe(5);
    expect(stats.latency.min).toBe(10);
    expect(stats.latency.max).toBe(50);
    expect(stats.latency.mean).toBe(30);
    expect(stats.statusCodes[200]).toBe(5);
  });

  it('handles mixed success and failure', () => {
    const results: RequestResult[] = [
      { status: 200, latency: 100 },
      { status: 500, latency: 200 },
      { status: 0, latency: 5000, error: 'timeout' },
    ];

    const stats = calculateStats(results, 5000);

    expect(stats.totalRequests).toBe(3);
    expect(stats.successfulRequests).toBe(2);
    expect(stats.failedRequests).toBe(1);
    expect(stats.statusCodes[200]).toBe(1);
    expect(stats.statusCodes[500]).toBe(1);
  });

  it('handles empty results', () => {
    const stats = calculateStats([], 0);
    expect(stats.totalRequests).toBe(0);
    expect(stats.latency.min).toBe(0);
    expect(stats.latency.mean).toBe(0);
    expect(stats.requestsPerSecond).toBe(0);
  });
});
