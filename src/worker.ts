import type { LoadTestOptions, RequestResult } from './types.js';

export async function sendRequest(options: LoadTestOptions): Promise<RequestResult> {
  const start = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    const res = await fetch(options.url, {
      method: options.method,
      headers: options.body
        ? { 'Content-Type': 'application/json', ...options.headers }
        : options.headers,
      body: options.body || undefined,
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    // Consume body to ensure full response timing
    await res.text();

    return {
      status: res.status,
      latency: performance.now() - start,
    };
  } catch (err) {
    return {
      status: 0,
      latency: performance.now() - start,
      error: (err as Error).message,
    };
  }
}
