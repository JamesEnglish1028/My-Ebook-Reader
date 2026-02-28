import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { fetchOpds2Feed } from '../opds2';

describe('fetchOpds2Feed - error conditions', () => {
  const url = 'https://example.org/catalog.json';
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = (globalThis as any).fetch;
  });
  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 401 status and empty books when unauthorized without credentials', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      status: 401,
  headers: { get: () => null },
      text: async () => 'Unauthorized',
    }));

    const res = await fetchOpds2Feed(url, null);
    expect(res.status).toBe(401);
    expect(res.books).toBeDefined();
    expect(res.books.length).toBe(0);
  });

  it('sends Authorization header when credentials provided and accepts 200 response', async () => {
    const credentials = { username: 'u', password: 'p' };
    (globalThis as any).fetch = vi.fn(async (_u: string, opts: any) => {
      const headers = opts?.headers || {};
      expect(headers['Authorization'] || headers['authorization']).toBeDefined();
      // return a valid OPDS JSON feed
      const body = JSON.stringify({ metadata: { title: 'OK' }, publications: [] });
  return { status: 200, headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/opds+json' : null }, text: async () => body };
    });

    const res = await fetchOpds2Feed(url, credentials);
    expect(res.status).toBe(200);
    expect(res.books).toBeDefined();
  });

  it('returns 429 status for rate-limited responses', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      status: 429,
  headers: { get: () => null },
      text: async () => 'Too Many Requests',
    }));

    const res = await fetchOpds2Feed(url, null);
    expect(res.status).toBe(429);
    expect(res.books.length).toBe(0);
  });

  it('throws when JSON is malformed', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      status: 200,
  headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/opds+json' : null },
      text: async () => 'not a json',
    }));

    await expect(fetchOpds2Feed(url, null)).rejects.toThrow();
  });

  it('reports upstream 403s distinctly from proxy-generated 403s', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      status: 403,
      headers: {
        get: (name: string) => {
          const key = name.toLowerCase();
          if (key === 'content-type') return 'text/plain';
          if (key === 'x-mebooks-proxy-error-source') return 'upstream';
          if (key === 'x-mebooks-upstream-status') return '403';
          return null;
        },
      },
      text: async () => 'Forbidden',
    }));

    const res = await fetchOpds2Feed(url, null);
    expect(res.status).toBe(403);
    expect(res.error).toContain('upstream server denied the request');
    expect(res.error).toContain('not a proxy allowlist rejection');
  });
});
