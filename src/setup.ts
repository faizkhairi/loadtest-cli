import type { SetupOptions } from './types.js';

export async function runSetup(options: SetupOptions): Promise<unknown> {
  const { url, method = 'GET', headers = {}, body } = options;

  const res = await fetch(url, {
    method,
    headers: body
      ? { 'Content-Type': 'application/json', ...headers }
      : headers,
    body: body || undefined,
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(
      `Setup request failed: ${res.status} ${res.statusText}`
    );
  }

  const text = await res.text();

  // Try to parse as JSON; fall back to raw text
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Interpolate {{SETUP_RESPONSE}} and {{SETUP_RESPONSE.key}} in a string.
 * Handles nested keys like {{SETUP_RESPONSE.data.token}}.
 */
export function interpolateSetupResponse(
  template: string,
  response: unknown
): string {
  return template.replace(/\{\{SETUP_RESPONSE(?:\.([^}]+))?\}\}/g, (_match, path?: string) => {
    if (!path) {
      return typeof response === 'string' ? response : JSON.stringify(response);
    }

    // Walk the path: "data.token" → response.data.token
    let value: unknown = response;
    for (const key of path.split('.')) {
      if (value == null || typeof value !== 'object') return '';
      value = (value as Record<string, unknown>)[key];
    }

    return value == null ? '' : String(value);
  });
}
