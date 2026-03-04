import type { LoadTestOptions, RequestResult, RequestContext } from './types.js';
import { interpolateSetupResponse } from './setup.js';

export async function sendRequest(
  options: LoadTestOptions,
  context?: RequestContext
): Promise<RequestResult> {
  const start = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    // Feature 3: Payload rotation — pick body from payloads array by index
    let body = options.body;
    if (context?.payloads && context.payloads.length > 0) {
      body = JSON.stringify(context.payloads[context.index % context.payloads.length]);
    }

    // Feature 5: Setup interpolation — replace {{SETUP_RESPONSE.key}} in body and headers
    let headers = { ...options.headers };
    if (context?.setupResponse != null) {
      if (body) {
        body = interpolateSetupResponse(body, context.setupResponse);
      }
      for (const [key, value] of Object.entries(headers)) {
        headers[key] = interpolateSetupResponse(value, context.setupResponse);
      }
    }

    // Add Content-Type for JSON bodies
    if (body) {
      headers = { 'Content-Type': 'application/json', ...headers };
    }

    const res = await fetch(options.url, {
      method: options.method,
      headers,
      body: body || undefined,
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    // Consume body — captured for assertions
    const responseBody = await res.text();

    // Feature 4: Response assertions
    let assertionFailed = false;
    let assertionError: string | undefined;

    if (options.assertStatus != null && res.status !== options.assertStatus) {
      assertionFailed = true;
      assertionError = `Expected status ${options.assertStatus}, got ${res.status}`;
    }

    if (!assertionFailed && options.assertBody != null && !responseBody.includes(options.assertBody)) {
      assertionFailed = true;
      assertionError = `Response body does not contain "${options.assertBody}"`;
    }

    return {
      status: res.status,
      latency: performance.now() - start,
      assertionFailed: assertionFailed || undefined,
      assertionError,
    };
  } catch (err) {
    return {
      status: 0,
      latency: performance.now() - start,
      error: (err as Error).message,
    };
  }
}
