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

  it('forces a new bearer token request when forceRefresh is set', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          accessToken: 'first-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          accessToken: 'second-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const authDocuments = await import('../authDocuments');
    const authDocument = {
      authentication: [
        {
          type: 'http://opds-spec.org/auth/basic-token',
          links: [{ rel: 'authenticate', href: 'https://example.com/authenticate' }],
        } as any,
      ],
    };

    const first = await authDocuments.getAuthorizationForAuthDocument(
      authDocument,
      'https://example.com/manifest.json',
      'user',
      'pass',
    );
    const second = await authDocuments.getAuthorizationForAuthDocument(
      authDocument,
      'https://example.com/manifest.json',
      'user',
      'pass',
      { forceRefresh: true },
    );

    expect(first).toEqual({ scheme: 'bearer', token: 'first-token' });
    expect(second).toEqual({ scheme: 'bearer', token: 'second-token' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
