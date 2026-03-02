import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { opdsAcquisitionService } from '../../domain/catalog';
import * as services from '../../services';
import type { CatalogBook } from '../../types';
import { useAuthAcquisitionCoordinator } from '../app/useAuthAcquisitionCoordinator';

describe('useAuthAcquisitionCoordinator', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('reuses a cached bearer token for Palace imports instead of reopening the credential prompt', async () => {
    const processAndSaveBook = vi.fn(async () => ({
      success: true,
      bookRecord: { id: 'book-1' } as any,
    }));
    const setImportStatus = vi.fn();
    const setActiveOpdsSource = vi.fn();
    const setCurrentView = vi.fn();
    const pushToast = vi.fn();
    const resolveSpy = vi.spyOn(opdsAcquisitionService, 'resolve').mockResolvedValue({
      success: true,
      data: 'https://minotaur.dev.palaceproject.io/minotaur-test-library/works/1/fulfill/1',
    });
    vi.spyOn(services, 'findCredentialForUrl').mockResolvedValue(null);
    vi.spyOn(services, 'getCachedAuthDocumentForUrl').mockReturnValue({
      id: 'auth-doc',
      title: 'Minotaur Test Library',
      authentication: [],
      links: [],
    } as any);
    vi.spyOn(services, 'getCachedPatronAuthorizationForUrl').mockReturnValue({
      scheme: 'bearer',
      token: 'cached-token',
    });
    vi.spyOn(services, 'maybeProxyForCors').mockResolvedValue('https://my-ebook-reader.onrender.com/proxy?url=fulfill');
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as any;

    const book: CatalogBook = {
      title: 'Loaned Book',
      author: 'Author',
      coverImage: null,
      downloadUrl: 'https://minotaur.dev.palaceproject.io/minotaur-test-library/works/1/fulfill/1',
      summary: null,
      providerId: 'palace-1',
      format: 'EPUB',
      isOpenAccess: false,
    };

    const { result } = renderHook(() => useAuthAcquisitionCoordinator({
      processAndSaveBook,
      setImportStatus,
      setActiveOpdsSource,
      setCurrentView,
      pushToast,
    }));

    await act(async () => {
      await result.current.handleImportFromCatalog(book, 'Palace');
    });

    await waitFor(() => {
      expect(resolveSpy).toHaveBeenCalledWith(
        book.downloadUrl,
        '1',
        { scheme: 'bearer', token: 'cached-token' },
      );
    });
    expect(result.current.credentialPrompt.isOpen).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://my-ebook-reader.onrender.com/proxy?url=fulfill',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer cached-token',
        }),
      }),
    );
  });
});
