import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendRequest } from '../src/worker.js';
import type { LoadTestOptions } from '../src/types.js';

const baseOptions: LoadTestOptions = {
  url: 'http://localhost:9999',
  requests: 10,
  concurrency: 1,
  method: 'GET',
  headers: {},
  timeout: 5000,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('{"ok":true,"method":"GET"}', { status: 200 }))
    )
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sendRequest — basic', () => {
  it('returns status and latency', async () => {
    const result = await sendRequest(baseOptions);
    expect(result.status).toBe(200);
    expect(result.latency).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
  });

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const result = await sendRequest(baseOptions);
    expect(result.status).toBe(0);
    expect(result.error).toBe('ECONNREFUSED');
  });
});

describe('sendRequest — payload rotation (Feature 3)', () => {
  it('uses payload from array by index', async () => {
    const payloads = [{ name: 'Alice' }, { name: 'Bob' }];
    await sendRequest({ ...baseOptions, method: 'POST' }, { index: 0, payloads });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({ name: 'Alice' });
  });

  it('rotates payloads round-robin', async () => {
    const payloads = [{ a: 1 }, { b: 2 }];
    await sendRequest({ ...baseOptions, method: 'POST' }, { index: 3, payloads });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    // index 3 % 2 = 1 → second payload
    expect(JSON.parse(call[1].body)).toEqual({ b: 2 });
  });
});

describe('sendRequest — assertions (Feature 4)', () => {
  it('passes when status matches', async () => {
    const result = await sendRequest({ ...baseOptions, assertStatus: 200 });
    expect(result.assertionFailed).toBeUndefined();
  });

  it('fails when status does not match', async () => {
    const result = await sendRequest({ ...baseOptions, assertStatus: 404 });
    expect(result.assertionFailed).toBe(true);
    expect(result.assertionError).toContain('Expected status 404, got 200');
  });

  it('passes when body contains substring', async () => {
    const result = await sendRequest({ ...baseOptions, assertBody: 'ok' });
    expect(result.assertionFailed).toBeUndefined();
  });

  it('fails when body does not contain substring', async () => {
    const result = await sendRequest({ ...baseOptions, assertBody: 'notfound' });
    expect(result.assertionFailed).toBe(true);
    expect(result.assertionError).toContain('does not contain');
  });
});

describe('sendRequest — setup interpolation (Feature 5)', () => {
  it('replaces {{SETUP_RESPONSE.key}} in headers', async () => {
    const opts = { ...baseOptions, headers: { Authorization: 'Bearer {{SETUP_RESPONSE.token}}' } };
    await sendRequest(opts, { index: 0, setupResponse: { token: 'abc123' } });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers.Authorization).toBe('Bearer abc123');
  });

  it('replaces {{SETUP_RESPONSE}} with full JSON in body', async () => {
    const opts = { ...baseOptions, method: 'POST', body: '{"data":"{{SETUP_RESPONSE}}"}' };
    await sendRequest(opts, { index: 0, setupResponse: { x: 1 } });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].body).toContain('{"x":1}');
  });
});
