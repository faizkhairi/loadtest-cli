import type { RequestResult, LoadTestStats } from './types.js';

export function calculateStats(
  results: RequestResult[],
  totalDuration: number
): LoadTestStats {
  const successful = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const latencies = successful.map((r) => r.latency).sort((a, b) => a - b);

  const statusCodes: Record<number, number> = {};
  for (const r of successful) {
    statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
  }

  return {
    totalRequests: results.length,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    totalDuration,
    requestsPerSecond:
      totalDuration > 0 ? results.length / (totalDuration / 1000) : 0,
    latency: {
      min: latencies[0] ?? 0,
      max: latencies[latencies.length - 1] ?? 0,
      mean: latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
    },
    statusCodes,
  };
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
