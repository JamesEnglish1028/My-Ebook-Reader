import React from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    vi.mocked(opdsParserService.fetchCatalog).mockReset();
  });

  it('fetches Palace lane previews one at a time and starts the next lane after the previous one finishes', async () => {
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

    await waitFor(() => expect(fetchCatalogMock).toHaveBeenCalledTimes(1));
    expect(fetchCatalogMock).toHaveBeenCalledWith('https://catalog.example.org/lane-1', 'https://catalog.example.org/catalog', '1');
    expect(fetchCatalogMock).not.toHaveBeenCalledWith('https://catalog.example.org/lane-2', expect.anything(), expect.anything());

    await act(async () => {
      responses[0].resolve({
        success: true,
        data: {
          books: [],
          navigationLinks: [],
        },
      });
    });

    await waitFor(() => expect(fetchCatalogMock).toHaveBeenCalledTimes(2));
    expect(fetchCatalogMock).toHaveBeenCalledWith('https://catalog.example.org/lane-2', 'https://catalog.example.org/catalog', '1');

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

  it('restores successful lane previews after unmounting and remounting', async () => {
    const link = { title: 'Lane 1', url: 'https://catalog.example.org/lane-restore', rel: 'collection' };
    const links = [link];
    const requestedUrls = [link.url];
    const fetchCatalogMock = vi.mocked(opdsParserService.fetchCatalog);

    fetchCatalogMock.mockResolvedValue({
      success: true,
      data: {
        books: [
          {
            title: 'Restored Book',
            author: 'Author',
            coverImage: 'https://covers.example.org/restored.jpg',
            downloadUrl: 'https://catalog.example.org/books/restored.epub',
            summary: null,
          },
        ],
        navigationLinks: [],
      },
    } as any);

    const first = renderHook(() => usePalaceLanePreviews({
      enabled: true,
      links: links as any,
      baseUrl: 'https://catalog.example.org/catalog',
      requestedUrls,
    }));

    await waitFor(() => {
      expect(fetchCatalogMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(first.result.current.lanePreviews[0]?.books[0]?.title).toBe('Restored Book');
    });

    first.unmount();

    const second = renderHook(() => usePalaceLanePreviews({
      enabled: true,
      links: links as any,
      baseUrl: 'https://catalog.example.org/catalog',
      requestedUrls: [],
    }));

    expect(second.result.current.lanePreviews[0]?.books[0]?.title).toBe('Restored Book');
    expect(fetchCatalogMock).toHaveBeenCalledTimes(1);
  });
});
