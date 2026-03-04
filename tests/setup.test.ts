import { describe, it, expect, vi, afterEach } from 'vitest';
import { runSetup, interpolateSetupResponse } from '../src/setup.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runSetup', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"token":"xyz"}', { status: 200 }))
    );
    const result = await runSetup({ url: 'http://localhost/login' });
    expect(result).toEqual({ token: 'xyz' });
  });

  it('returns raw text when response is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('plain text', { status: 200 }))
    );
    const result = await runSetup({ url: 'http://localhost/login' });
    expect(result).toBe('plain text');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }))
    );
    await expect(runSetup({ url: 'http://localhost/login' })).rejects.toThrow('Setup request failed: 401');
  });

  it('sends correct method and body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    await runSetup({ url: 'http://localhost/login', method: 'POST', body: '{"user":"admin"}' });

    expect(mockFetch).toHaveBeenCalledWith('http://localhost/login', expect.objectContaining({
      method: 'POST',
      body: '{"user":"admin"}',
    }));
  });
});

describe('interpolateSetupResponse', () => {
  it('replaces {{SETUP_RESPONSE}} with full JSON', () => {
    const result = interpolateSetupResponse('data={{SETUP_RESPONSE}}', { a: 1 });
    expect(result).toBe('data={"a":1}');
  });

  it('replaces {{SETUP_RESPONSE.key}} with value', () => {
    const result = interpolateSetupResponse('Bearer {{SETUP_RESPONSE.token}}', { token: 'abc' });
    expect(result).toBe('Bearer abc');
  });

  it('handles nested paths', () => {
    const result = interpolateSetupResponse('{{SETUP_RESPONSE.data.id}}', { data: { id: 42 } });
    expect(result).toBe('42');
  });

  it('returns empty string for missing paths', () => {
    const result = interpolateSetupResponse('{{SETUP_RESPONSE.missing}}', { token: 'abc' });
    expect(result).toBe('');
  });

  it('handles string response for {{SETUP_RESPONSE}}', () => {
    const result = interpolateSetupResponse('val={{SETUP_RESPONSE}}', 'hello');
    expect(result).toBe('val=hello');
  });
});
