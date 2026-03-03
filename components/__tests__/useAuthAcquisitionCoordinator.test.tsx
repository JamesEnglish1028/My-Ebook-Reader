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

  it('follows Library Simplified bearer-token fulfillment documents to the actual file', async () => {
    const processAndSaveBook = vi.fn(async () => ({
      success: true,
      bookRecord: { id: 'book-2' } as any,
    }));
    const setImportStatus = vi.fn();
    const setActiveOpdsSource = vi.fn();
    const setCurrentView = vi.fn();
    const pushToast = vi.fn();
    vi.spyOn(opdsAcquisitionService, 'resolve').mockResolvedValue({
      success: true,
      data: 'https://minotaur.dev.palaceproject.io/minotaur-test-library/works/1/fulfill/9',
    });
    vi.spyOn(services, 'findCredentialForUrl').mockResolvedValue(null);
    vi.spyOn(services, 'getCachedAuthDocumentForUrl').mockReturnValue(null);
    vi.spyOn(services, 'getCachedPatronAuthorizationForUrl').mockReturnValue({
      scheme: 'bearer',
      token: 'palace-token',
    });
    vi.spyOn(services, 'maybeProxyForCors').mockResolvedValue('https://my-ebook-reader.onrender.com/proxy?url=fulfill9');

    const initialResponse = {
      ok: true,
      url: 'https://my-ebook-reader.onrender.com/proxy?url=fulfill9',
      headers: {
        get: (name: string) => name === 'Content-Type'
          ? 'application/vnd.librarysimplified.bearer-token+json'
          : null,
      },
      text: async () => JSON.stringify({
        token_type: 'Bearer',
        access_token: 'ls-follow-up-token',
        expires_in: 3600,
        location: 'https://downloads.example.org/book.pdf',
      }),
    };
    const finalResponse = {
      ok: true,
      headers: {
        get: (name: string) => name === 'Content-Type'
          ? 'application/pdf'
          : null,
      },
      arrayBuffer: async () => new ArrayBuffer(16),
    };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(initialResponse as any)
      .mockResolvedValueOnce(finalResponse as any) as any;

    const book: CatalogBook = {
      title: 'Token Wrapped Book',
      author: 'Author',
      coverImage: null,
      downloadUrl: 'https://minotaur.dev.palaceproject.io/minotaur-test-library/works/1/fulfill/9',
      summary: null,
      providerId: 'palace-2',
      format: 'PDF',
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
      expect(globalThis.fetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/proxy?url=https%3A%2F%2Fdownloads.example.org%2Fbook.pdf'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer ls-follow-up-token',
          }),
        }),
      );
    });
    expect(processAndSaveBook).toHaveBeenCalled();
  });

  it('borrows protected Palace titles without importing them locally', async () => {
    const processAndSaveBook = vi.fn(async () => ({
      success: true,
      bookRecord: { id: 'book-3' } as any,
    }));
    const setImportStatus = vi.fn();
    const setActiveOpdsSource = vi.fn();
    const setCurrentView = vi.fn();
    const pushToast = vi.fn();
    const resolveSpy = vi.spyOn(opdsAcquisitionService, 'resolve').mockResolvedValue({
      success: true,
      data: 'https://minotaur.dev.palaceproject.io/minotaur-test-library/works/3/fulfill/3',
    });
    vi.spyOn(services, 'findCredentialForUrl').mockResolvedValue(null);
    vi.spyOn(services, 'getCachedAuthDocumentForUrl').mockReturnValue(null);
    vi.spyOn(services, 'getCachedPatronAuthorizationForUrl').mockReturnValue({
      scheme: 'bearer',
      token: 'palace-token',
    });

    const book: CatalogBook = {
      title: 'Protected Palace Book',
      author: 'Author',
      coverImage: null,
      downloadUrl: 'https://minotaur.dev.palaceproject.io/minotaur-test-library/works/3/fulfill/3',
      summary: null,
      providerId: 'palace-protected-1',
      format: 'EPUB',
      isLcpProtected: true,
      isOpenAccess: false,
    };

    const { result } = renderHook(() => useAuthAcquisitionCoordinator({
      processAndSaveBook,
      setImportStatus,
      setActiveOpdsSource,
      setCurrentView,
      pushToast,
    }));

    let actionResult: any;
    await act(async () => {
      actionResult = await result.current.handleBorrowForPalace(book, 'Palace');
    });

    expect(resolveSpy).toHaveBeenCalledWith(
      book.downloadUrl,
      '1',
      { scheme: 'bearer', token: 'palace-token' },
    );
    expect(actionResult).toEqual({ success: true, action: 'palace-borrow' });
    expect(processAndSaveBook).not.toHaveBeenCalled();
  });

  it('downloads protected LCP titles for Thorium instead of importing them', async () => {
    const processAndSaveBook = vi.fn(async () => ({
      success: true,
      bookRecord: { id: 'book-4' } as any,
    }));
    const setImportStatus = vi.fn();
    const setActiveOpdsSource = vi.fn();
    const setCurrentView = vi.fn();
    const pushToast = vi.fn();
    vi.spyOn(opdsAcquisitionService, 'resolve').mockResolvedValue({
      success: true,
      data: 'https://generic.example.org/fulfill/lcp',
    });
    vi.spyOn(services, 'findCredentialForUrl').mockResolvedValue(null);
    vi.spyOn(services, 'getCachedAuthDocumentForUrl').mockReturnValue(null);
    vi.spyOn(services, 'getCachedPatronAuthorizationForUrl').mockReturnValue(null);
    vi.spyOn(services, 'maybeProxyForCors').mockResolvedValue('https://my-ebook-reader.onrender.com/proxy?url=lcp');

    const nativeCreateElement = document.createElement.bind(document);
    const anchorClick = vi.fn();
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        const link = nativeCreateElement('a');
        link.click = anchorClick;
        return link;
      }
      return nativeCreateElement(tagName);
    });
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:test') as any;
    URL.revokeObjectURL = vi.fn() as any;

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === 'Content-Type') return 'application/vnd.readium.lcp.license.v1.0+json';
          if (name === 'Content-Disposition') return 'attachment; filename="protected-book.lcpl"';
          return null;
        },
      },
      blob: async () => new Blob(['lcp'], { type: 'application/vnd.readium.lcp.license.v1.0+json' }),
    })) as any;

    const book: CatalogBook = {
      title: 'Protected LCP Book',
      author: 'Author',
      coverImage: null,
      downloadUrl: 'https://generic.example.org/borrow/lcp',
      summary: null,
      providerId: 'generic-lcp-1',
      format: 'EPUB',
      isLcpProtected: true,
      isOpenAccess: false,
    };

    const { result } = renderHook(() => useAuthAcquisitionCoordinator({
      processAndSaveBook,
      setImportStatus,
      setActiveOpdsSource,
      setCurrentView,
      pushToast,
    }));

    let actionResult: any;
    await act(async () => {
      actionResult = await result.current.handleDownloadForThorium(book, 'Generic');
    });

    expect(actionResult).toEqual({ success: true, action: 'thorium-download' });
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(processAndSaveBook).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    createSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });
});
