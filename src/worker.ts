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

    // Feature 7: Multipart file upload — or JSON body
    let fetchBody: string | FormData | undefined;

    if (options.file) {
      const form = new FormData();
      const file = new File([new Uint8Array(options.file)], options.fileName || 'file');
      form.append(options.fileField || 'file', file);
      if (options.formFields) {
        for (const [key, val] of Object.entries(options.formFields)) {
          let value = val;
          if (context?.setupResponse != null) {
            value = interpolateSetupResponse(value, context.setupResponse);
          }
          form.append(key, value);
        }
      }
      fetchBody = form;
      // Do NOT set Content-Type — fetch auto-sets multipart/form-data with boundary
    } else {
      if (body) {
        headers = { 'Content-Type': 'application/json', ...headers };
      }
      fetchBody = body || undefined;
    }

    const res = await fetch(options.url, {
      method: options.method,
      headers,
      body: fetchBody,
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
