import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runLoadTest } from '../src/runner.js';
import type { LoadTestOptions } from '../src/types.js';

const baseOptions: LoadTestOptions = {
  url: 'http://localhost:9999',
  requests: 10,
  concurrency: 2,
  method: 'GET',
  headers: {},
  timeout: 5000,
};

beforeEach(() => {
  // Must create a NEW Response per call — Response.text() can only be consumed once
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('{"ok":true}', { status: 200 }))
    )
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runLoadTest — requests mode', () => {
  it('completes all requests', async () => {
    const stats = await runLoadTest(baseOptions);
    expect(stats.totalRequests).toBe(10);
    expect(stats.successfulRequests).toBe(10);
    expect(stats.failedRequests).toBe(0);
  });

  it('calls onProgress callback', async () => {
    const progress: number[] = [];
    await runLoadTest(baseOptions, {
      onProgress(completed) {
        progress.push(completed);
      },
    });
    expect(progress.length).toBe(10);
    expect(progress[progress.length - 1]).toBe(10);
  });

  it('passes context to workers', async () => {
    const payloads = [{ x: 1 }];
    const stats = await runLoadTest(
      { ...baseOptions, requests: 3 },
      undefined,
      { payloads, setupResponse: { token: 'test' } }
    );
    expect(stats.totalRequests).toBe(3);
    // Verify fetch was called with payload body
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of calls) {
      expect(call[1].body).toBe('{"x":1}');
    }
  });
});

describe('runLoadTest — duration mode (Feature 1)', () => {
  it('runs for specified duration', async () => {
    // Each fetch takes ~0ms (mocked), so many requests will fire in 1s
    const stats = await runLoadTest({ ...baseOptions, duration: 1, requests: Infinity });
    expect(stats.totalRequests).toBeGreaterThan(0);
    expect(stats.totalDuration).toBeGreaterThanOrEqual(900); // ~1s, allow some tolerance
    expect(stats.totalDuration).toBeLessThan(3000); // shouldn't take 3s
  });

  it('uses full concurrency in duration mode', async () => {
    // With concurrency=5 and mocked fetch, should fire many requests
    const stats = await runLoadTest({
      ...baseOptions,
      concurrency: 5,
      duration: 0.5,
      requests: Infinity,
    });
    expect(stats.totalRequests).toBeGreaterThan(0);
  });
});

describe('runLoadTest — RPS rate limiting (Feature 2)', () => {
  it('limits request rate', async () => {
    // 5 rps with 10 requests should take ~2s
    const start = Date.now();
    const stats = await runLoadTest({ ...baseOptions, requests: 10, rps: 5 });
    const elapsed = Date.now() - start;

    expect(stats.totalRequests).toBe(10);
    // Should take at least 1s (first 5 immediate, next 5 after 1s refill)
    expect(elapsed).toBeGreaterThanOrEqual(900);
  });
});

describe('runLoadTest — assertions (Feature 4)', () => {
  it('counts assertion failures separately', async () => {
    const stats = await runLoadTest({
      ...baseOptions,
      requests: 5,
      assertStatus: 404, // will fail — mock returns 200
    });
    expect(stats.totalRequests).toBe(5);
    expect(stats.successfulRequests).toBe(5); // HTTP succeeded
    expect(stats.assertionFailures).toBe(5); // but assertions failed
    expect(stats.failedRequests).toBe(0); // no network errors
  });
});
