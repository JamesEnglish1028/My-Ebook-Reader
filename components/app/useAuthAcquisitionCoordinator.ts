import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { opdsAcquisitionService } from '../../domain/catalog';
import {
  findCredentialForUrl,
  logger,
  maybeProxyForCors,
  proxiedUrl,
  saveOpdsCredential,
} from '../../services';

import type {
  BookRecord,
  Catalog,
  CatalogBook,
  CatalogRegistry,
  CredentialPrompt,
} from '../../types';
import type { ImportStatusState } from './useImportCoordinator';

interface ImportResult {
  success: boolean;
  bookRecord?: BookRecord;
  existingBook?: BookRecord;
}

interface UseAuthAcquisitionCoordinatorOptions {
  processAndSaveBook: (
    bookData: ArrayBuffer,
    fileName?: string,
    authorName?: string,
    source?: 'file' | 'catalog',
    providerName?: string,
    providerId?: string,
    format?: string,
    coverImageUrl?: string | null,
    catalogBookMeta?: Partial<CatalogBook>,
  ) => Promise<{ success: boolean; bookRecord?: BookRecord; existingBook?: BookRecord }>;
  setImportStatus: Dispatch<SetStateAction<ImportStatusState>>;
  setActiveOpdsSource: Dispatch<SetStateAction<Catalog | CatalogRegistry | null>>;
  setCurrentView: Dispatch<SetStateAction<'library' | 'reader' | 'pdfReader' | 'bookDetail' | 'about'>>;
  pushToast: (message: string, duration?: number) => void;
}

const initialCredentialPrompt: CredentialPrompt = {
  isOpen: false,
  host: null,
  pendingHref: null,
  pendingBook: null,
  pendingCatalogName: undefined,
  authDocument: null,
};

export const useAuthAcquisitionCoordinator = ({
  processAndSaveBook,
  setImportStatus,
  setActiveOpdsSource,
  setCurrentView,
  pushToast,
}: UseAuthAcquisitionCoordinatorOptions) => {
  const [credentialPrompt, setCredentialPrompt] = useState<CredentialPrompt>(initialCredentialPrompt);
  const [showNetworkDebug, setShowNetworkDebug] = useState(false);

  const handleImportFromCatalog = useCallback(async (book: CatalogBook, catalogName?: string): Promise<ImportResult> => {
    if (book.format && book.format.toUpperCase() !== 'EPUB' && book.format.toUpperCase() !== 'PDF') {
      const error = `Cannot import this book. The application currently only supports EPUB and PDF formats, but this book is a ${book.format}.`;
      setImportStatus({ isLoading: false, message: '', error });
      return { success: false };
    }

    setImportStatus({ isLoading: true, message: `Downloading ${book.title}...`, error: null });
    try {
      let finalUrl = book.downloadUrl;

      if (!book.isOpenAccess) {
        const cred = await findCredentialForUrl(book.downloadUrl);
        const resolveResult = await opdsAcquisitionService.resolve(
          book.downloadUrl,
          'auto',
          cred ? { username: cred.username, password: cred.password } : null,
        );

        if (resolveResult.success) {
          finalUrl = resolveResult.data;
        } else {
          const errorResult = resolveResult as { success: false; error: string; status?: number };
          if (errorResult.status === 401 || errorResult.status === 403) {
            setImportStatus({ isLoading: false, message: '', error: null });
            setCredentialPrompt({
              isOpen: true,
              host: new URL(book.downloadUrl).host,
              pendingHref: book.downloadUrl,
              pendingBook: book,
              pendingCatalogName: catalogName,
              authDocument: null,
            });
            return { success: false };
          }
          logger.warn('Failed to resolve acquisition chain, using original URL', errorResult.error);
        }
      }

      let proxyUrl = await maybeProxyForCors(finalUrl, book.isOpenAccess === true);
      const storedCred = await findCredentialForUrl(book.downloadUrl);
      const downloadHeaders: Record<string, string> = {};
      if (storedCred) {
        downloadHeaders.Authorization = `Basic ${btoa(`${storedCred.username}:${storedCred.password}`)}`;
      }

      let response: Response;
      if (book.isOpenAccess) {
        try {
          response = await fetch(finalUrl, { headers: downloadHeaders, credentials: 'include', redirect: 'follow' });
        } catch {
          proxyUrl = proxiedUrl(finalUrl);
          response = await fetch(proxyUrl, { headers: {}, credentials: 'omit', redirect: 'follow' });
        }
      } else {
        response = await fetch(proxyUrl, { headers: downloadHeaders, credentials: proxyUrl === finalUrl ? 'include' : 'omit' });
      }

      if (!response.ok) {
        const statusInfo = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
        let errorMessage = `Download failed. The server responded with an error (${statusInfo}). The book might not be available at this address.`;
        if (response.status === 401 || response.status === 403) {
          errorMessage = `Download failed (${statusInfo}). This catalog or book requires authentication (a login or password), which is not supported by this application.`;
        }
        if (response.status === 429) {
          errorMessage = `Download failed (${statusInfo}). The request was rate-limited by the server or the proxy. Please wait a moment and try again.`;
        }
        throw new Error(errorMessage);
      }

      const bookData = await response.arrayBuffer();
      const catalogBookMeta = book.format && book.format.toUpperCase() === 'PDF'
        ? {
            summary: book.summary,
            publisher: book.publisher,
            publicationDate: book.publicationDate,
            subjects: book.subjects,
            coverImage: book.coverImage,
          }
        : undefined;

      const result = await processAndSaveBook(
        bookData,
        book.title,
        book.author,
        'catalog',
        catalogName,
        book.providerId,
        book.format,
        book.coverImage,
        catalogBookMeta,
      );

      if (result.success) {
        setActiveOpdsSource(null);
        setCurrentView('library');
      }

      return result;
    } catch (error) {
      logger.error('Error importing from catalog:', error);
      let message = 'Download failed. The file may no longer be available or there was a network issue.';
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        message = 'Download failed due to a network error. This could be due to your internet connection or the public CORS proxy being temporarily down.';
      } else if (error instanceof Error) {
        message = error.message;
      }
      setImportStatus({ isLoading: false, message: '', error: message });
      return { success: false };
    }
  }, [processAndSaveBook, setActiveOpdsSource, setCurrentView, setImportStatus]);

  const handleCredentialSubmit = useCallback(async (username: string, password: string, save: boolean) => {
    if (!credentialPrompt.pendingHref) {
      setCredentialPrompt(initialCredentialPrompt);
      return;
    }

    const href = credentialPrompt.pendingHref;
    try {
      const resolveResult = await opdsAcquisitionService.resolve(href, 'auto', { username, password });
      if (resolveResult.success && credentialPrompt.pendingBook) {
        if (save && credentialPrompt.host) {
          saveOpdsCredential(credentialPrompt.host, username, password);
        }
        setCredentialPrompt(initialCredentialPrompt);
        setImportStatus({ isLoading: true, message: `Downloading ${credentialPrompt.pendingBook.title}...`, error: null });
        const proxyUrl = await maybeProxyForCors(resolveResult.data);
        const downloadHeaders: Record<string, string> = {};
        if (username && password) {
          downloadHeaders.Authorization = `Basic ${btoa(`${username}:${password}`)}`;
        }
        const response = await fetch(proxyUrl, {
          headers: downloadHeaders,
          credentials: proxyUrl === resolveResult.data ? 'include' : 'omit',
        });
        if (!response.ok) {
          throw new Error(`Download failed: ${response.status}`);
        }
        const bookData = await response.arrayBuffer();
        const importResult = await processAndSaveBook(
          bookData,
          credentialPrompt.pendingBook.title,
          credentialPrompt.pendingBook.author,
          'catalog',
          credentialPrompt.pendingCatalogName,
          credentialPrompt.pendingBook.providerId,
          credentialPrompt.pendingBook.format,
          credentialPrompt.pendingBook.coverImage,
        );
        if (!importResult.success && importResult.existingBook) {
          setImportStatus({
            isLoading: false,
            message: '',
            error: `A book with the same identifier is already in your library: "${importResult.existingBook.title}".`,
          });
        }
      } else {
        setImportStatus({ isLoading: false, message: '', error: 'Failed to resolve acquisition URL.' });
        setCredentialPrompt(initialCredentialPrompt);
      }
    } catch (error) {
      logger.error('Credential resolve/import failed', error);
      setImportStatus({ isLoading: false, message: '', error: error instanceof Error ? error.message : 'Failed to authenticate and download the book.' });
      setCredentialPrompt(initialCredentialPrompt);
    }
  }, [credentialPrompt, processAndSaveBook, setImportStatus]);

  const handleOpenAuthLink = useCallback((href: string) => {
    void href;
    // Intentionally no-op. Opening is handled by the credentials modal.
  }, []);

  const handleRetryAfterProviderLogin = useCallback(async () => {
    if (!credentialPrompt.pendingHref || !credentialPrompt.pendingBook) return;
    setImportStatus({ isLoading: true, message: 'Retrying download after provider login...', error: null });
    try {
      const resolveResult = await opdsAcquisitionService.resolve(credentialPrompt.pendingHref, 'auto', null);
      if (!resolveResult.success) {
        throw new Error('Failed to resolve after login');
      }

      const proxyUrl = await maybeProxyForCors(resolveResult.data);
      if (typeof proxyUrl === 'string' && proxyUrl.includes('corsproxy.io')) {
        pushToast('The retry would use a public CORS proxy which commonly strips authentication. Configure an owned proxy via VITE_OWN_PROXY_URL and retry.', 12000);
        throw new Error('Retry aborted: public CORS proxy would be used and may block authenticated downloads.');
      }

      const response = await fetch(proxyUrl, { credentials: proxyUrl === resolveResult.data ? 'include' : 'omit' });
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const bookData = await response.arrayBuffer();
      const importResult = await processAndSaveBook(
        bookData,
        credentialPrompt.pendingBook.title,
        credentialPrompt.pendingBook.author,
        'catalog',
        credentialPrompt.pendingCatalogName,
        credentialPrompt.pendingBook.providerId,
        credentialPrompt.pendingBook.format,
        credentialPrompt.pendingBook.coverImage,
      );
      if (!importResult.success && importResult.existingBook) {
        setImportStatus({
          isLoading: false,
          message: '',
          error: `A book with the same identifier is already in your library: "${importResult.existingBook.title}".`,
        });
      }
      setCredentialPrompt(initialCredentialPrompt);
    } catch (error) {
      logger.error('Retry after provider login failed', error);
      setImportStatus({ isLoading: false, message: '', error: error instanceof Error ? error.message : 'Retry failed' });
    }
  }, [credentialPrompt, processAndSaveBook, pushToast, setImportStatus]);

  return {
    credentialPrompt,
    setCredentialPrompt,
    handleImportFromCatalog,
    handleCredentialSubmit,
    handleOpenAuthLink,
    handleRetryAfterProviderLogin,
    showNetworkDebug,
    setShowNetworkDebug,
  };
};
