import type { LoadTestStats } from '../types.js';

export function formatJsonReport(stats: LoadTestStats, url: string): string {
  return JSON.stringify(
    {
      url,
      timestamp: new Date().toISOString(),
      ...stats,
    },
    null,
    2
  );
}
