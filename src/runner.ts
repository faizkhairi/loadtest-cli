import type { LoadTestOptions, RequestResult, LoadTestStats } from './types.js';
import { sendRequest } from './worker.js';
import { calculateStats } from './stats.js';

export interface RunnerCallbacks {
  onProgress: (completed: number, total: number) => void;
}

export async function runLoadTest(
  options: LoadTestOptions,
  callbacks?: RunnerCallbacks
): Promise<LoadTestStats> {
  const results: RequestResult[] = [];
  let completed = 0;

  const start = performance.now();

  // Create a pool of concurrent workers
  const queue: Promise<void>[] = [];
  let nextRequest = 0;

  async function worker() {
    while (nextRequest < options.requests) {
      const idx = nextRequest++;
      if (idx >= options.requests) break;

      const result = await sendRequest(options);
      results.push(result);
      completed++;
      callbacks?.onProgress(completed, options.requests);
    }
  }

  // Launch concurrent workers
  const workerCount = Math.min(options.concurrency, options.requests);
  for (let i = 0; i < workerCount; i++) {
    queue.push(worker());
  }

  await Promise.all(queue);

  const totalDuration = performance.now() - start;
  return calculateStats(results, totalDuration);
}
