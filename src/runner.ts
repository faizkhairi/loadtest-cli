import type { LoadTestOptions, RequestResult, LoadTestStats, LoadTestContext } from './types.js';
import { sendRequest } from './worker.js';
import { calculateStats } from './stats.js';

export interface RunnerCallbacks {
  onProgress: (completed: number, total: number) => void;
}

// ── RPS Token Bucket ──────────────────────────────────

interface TokenBucket {
  tokens: number;
  max: number;
  waiters: Array<() => void>;
}

function createBucket(rps: number): TokenBucket {
  return { tokens: rps, max: rps, waiters: [] };
}

function waitForToken(bucket: TokenBucket): Promise<void> {
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    bucket.waiters.push(resolve);
  });
}

function refillBucket(bucket: TokenBucket): void {
  const available = Math.min(bucket.max, bucket.max - bucket.tokens + bucket.waiters.length);
  // Release waiting workers first
  while (bucket.waiters.length > 0 && available > 0) {
    const waiter = bucket.waiters.shift();
    waiter?.();
    bucket.tokens = Math.max(0, bucket.tokens - 1);
  }
  // Refill remaining tokens
  bucket.tokens = Math.min(bucket.max, bucket.tokens + bucket.max);
}

// ── Main Runner ───────────────────────────────────────

export async function runLoadTest(
  options: LoadTestOptions,
  callbacks?: RunnerCallbacks,
  context?: LoadTestContext
): Promise<LoadTestStats> {
  const results: RequestResult[] = [];
  let completed = 0;

  const start = performance.now();
  const isDuration = options.duration != null && options.duration > 0;
  // Use Date.now() for deadline — must match the Date.now() check in the worker loop
  const deadline = isDuration ? Date.now() + options.duration! * 1000 : 0;

  // RPS token bucket (if rate limiting enabled)
  let bucket: TokenBucket | undefined;
  let bucketTimer: ReturnType<typeof setInterval> | undefined;

  if (options.rps) {
    bucket = createBucket(options.rps);
    bucketTimer = setInterval(() => refillBucket(bucket!), 1000);
  }

  // Create a pool of concurrent workers
  const queue: Promise<void>[] = [];
  let nextRequest = 0;

  async function worker() {
    if (isDuration) {
      // Duration mode: loop until deadline
      while (Date.now() < deadline) {
        const idx = nextRequest++;

        if (bucket) await waitForToken(bucket);

        const result = await sendRequest(options, {
          index: idx,
          payloads: context?.payloads,
          setupResponse: context?.setupResponse,
        });
        results.push(result);
        completed++;
        callbacks?.onProgress(completed, options.requests);
      }
    } else {
      // Requests mode: existing behavior
      while (nextRequest < options.requests) {
        const idx = nextRequest++;
        if (idx >= options.requests) break;

        if (bucket) await waitForToken(bucket);

        const result = await sendRequest(options, {
          index: idx,
          payloads: context?.payloads,
          setupResponse: context?.setupResponse,
        });
        results.push(result);
        completed++;
        callbacks?.onProgress(completed, options.requests);
      }
    }
  }

  // Launch concurrent workers
  const workerCount = isDuration
    ? options.concurrency
    : Math.min(options.concurrency, options.requests);

  for (let i = 0; i < workerCount; i++) {
    queue.push(worker());
  }

  await Promise.all(queue);

  // Clean up RPS timer to prevent leaked setInterval
  if (bucketTimer) clearInterval(bucketTimer);

  const totalDuration = performance.now() - start;
  return calculateStats(results, totalDuration);
}
