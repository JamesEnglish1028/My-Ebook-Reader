import { afterEach, describe, expect, it, vi } from 'vitest';

describe('authDocuments bearer token expiry', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('preserves the original expiresIn returned by the auth document flow', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00Z'));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        accessToken: 'short-lived-token',
        tokenType: 'Bearer',
        expiresIn: 30,
      }),
    }));

    const authDocuments = await import('../authDocuments');

    await authDocuments.getAuthorizationForAuthDocument(
      {
        authentication: [
          {
            type: 'http://opds-spec.org/auth/basic-token',
            links: [{ rel: 'authenticate', href: 'https://example.com/authenticate' }],
          } as any,
        ],
      },
      'https://example.com/manifest.json',
      'user',
      'pass',
    );

    expect(authDocuments.getCachedPatronAuthorizationForUrl('https://example.com/manifest.json')).toEqual({
      scheme: 'bearer',
      token: 'short-lived-token',
    });

    vi.advanceTimersByTime(31_000);

    expect(authDocuments.getCachedPatronAuthorizationForUrl('https://example.com/manifest.json')).toBeNull();
  });
});
