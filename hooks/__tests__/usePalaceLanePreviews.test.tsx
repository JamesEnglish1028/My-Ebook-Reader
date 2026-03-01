import React from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { opdsParserService } from '../../domain/catalog';
import { usePalaceLanePreviews } from '../usePalaceLanePreviews';

vi.mock('../../domain/catalog', async () => {
  const actual = await vi.importActual<typeof import('../../domain/catalog')>('../../domain/catalog');
  return {
    ...actual,
    opdsParserService: {
      fetchCatalog: vi.fn(),
    },
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('usePalaceLanePreviews', () => {
  it('limits concurrent preview fetches and starts queued lanes as earlier ones finish', async () => {
    const links = [
      { title: 'Lane 1', url: 'https://catalog.example.org/lane-1', rel: 'collection' },
      { title: 'Lane 2', url: 'https://catalog.example.org/lane-2', rel: 'collection' },
      { title: 'Lane 3', url: 'https://catalog.example.org/lane-3', rel: 'collection' },
      { title: 'Lane 4', url: 'https://catalog.example.org/lane-4', rel: 'collection' },
    ];

    const responses = links.map(() => deferred<any>());
    const fetchCatalogMock = vi.mocked(opdsParserService.fetchCatalog);

    fetchCatalogMock.mockImplementation((url) => {
      const index = links.findIndex((link) => link.url === url);
      return responses[index].promise;
    });

    renderHook(() => usePalaceLanePreviews({
      enabled: true,
      links: links as any,
      baseUrl: 'https://catalog.example.org/catalog',
      requestedUrls: links.map((link) => link.url),
    }));

    await waitFor(() => expect(fetchCatalogMock).toHaveBeenCalledTimes(3));
    expect(fetchCatalogMock).not.toHaveBeenCalledWith('https://catalog.example.org/lane-4', expect.anything(), expect.anything());

    await act(async () => {
      responses[0].resolve({
        success: true,
        data: {
          books: [],
          navigationLinks: [],
        },
      });
    });

    await waitFor(() => expect(fetchCatalogMock).toHaveBeenCalledTimes(4));
    expect(fetchCatalogMock).toHaveBeenCalledWith('https://catalog.example.org/lane-4', 'https://catalog.example.org/catalog', '1');

    await act(async () => {
      responses.slice(1).forEach((response) => {
        response.resolve({
          success: true,
          data: {
            books: [],
            navigationLinks: [],
          },
        });
      });
    });
  });
});
