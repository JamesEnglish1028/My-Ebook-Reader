import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { CatalogImportMeta } from '../../domain/book';
import { buildCatalogImportMeta } from '../../domain/book';
import { opdsAcquisitionService } from '../../domain/catalog';
import {
  cachePatronAuthorizationForUrl,
  findCredentialForUrl,
  getAuthorizationForAuthDocument,
  getCachedAuthDocumentForUrl,
  getCachedPatronAuthorizationForUrl,
  logger,
  maybeProxyForCors,
  proxiedUrl,
  saveOpdsCredential,
} from '../../services';
import { parseAudiobookManifest } from '../../services/audiobookManifest';

import type {
  BookRecord,
  Catalog,
  CatalogBook,
  CatalogRegistry,
  CredentialPrompt,
  RequestAuthorization,
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
    catalogBookMeta?: CatalogImportMeta,
  ) => Promise<{ success: boolean; bookRecord?: BookRecord; existingBook?: BookRecord }>;
  saveExternalReaderPlaceholder: (
    book: CatalogBook,
    providerName?: string,
    externalReaderApp?: 'palace' | 'thorium',
  ) => Promise<{ success: boolean; bookRecord?: BookRecord; existingBook?: BookRecord }>;
  setImportStatus: Dispatch<SetStateAction<ImportStatusState>>;
  setActiveOpdsSource: Dispatch<SetStateAction<Catalog | CatalogRegistry | null>>;
  setCurrentView: Dispatch<SetStateAction<'library' | 'reader' | 'pdfReader' | 'audioReader' | 'bookDetail' | 'about'>>;
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

const buildAuthorizationHeader = (auth: RequestAuthorization): string => (
  auth.scheme === 'bearer'
    ? `Bearer ${auth.token}`
    : `Basic ${btoa(`${auth.username}:${auth.password}`)}`
);

const getContentType = (response: Response): string => (
  response.headers && typeof response.headers.get === 'function'
    ? (response.headers.get('Content-Type') || '')
    : ''
);

interface FulfillResponseResult {
  response: Response;
  resolvedUrl?: string;
  followUpAuth?: RequestAuthorization | null;
}

interface ProtectedActionResult {
  success: boolean;
  action?: 'palace-borrow' | 'thorium-download';
  error?: string;
}

const extractFileNameFromContentDisposition = (value: string | null): string | null => {
  if (!value) return null;

  const utf8Match = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }

  const quotedMatch = value.match(/filename\s*=\s*"([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const plainMatch = value.match(/filename\s*=\s*([^;]+)/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return null;
};

const inferProtectedDownloadFileName = (
  response: Response,
  book: Pick<CatalogBook, 'title'>,
): string => {
  const contentDisposition = response.headers?.get?.('Content-Disposition') || null;
  const contentType = getContentType(response).toLowerCase();
  const providedName = extractFileNameFromContentDisposition(contentDisposition);
  if (providedName) {
    return providedName;
  }

  const safeTitle = (book.title || 'book')
    .replace(/[^\w\d-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'book';

  if (contentType.includes('application/vnd.readium.lcp.license.v1.0+json') || contentType.includes('readium.lcp')) {
    return `${safeTitle}.lcpl`;
  }
  if (contentType.includes('pdf')) {
    return `${safeTitle}.pdf`;
  }
  if (contentType.includes('epub')) {
    return `${safeTitle}.epub`;
  }

  return `${safeTitle}.lcpl`;
};

const triggerBrowserDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }, 0);
};

const resolveLibrarySimplifiedBearerTokenDocument = async (
  response: Response,
  fallbackUrl: string,
): Promise<FulfillResponseResult> => {
  const contentType = getContentType(response).toLowerCase();
  if (!contentType.includes('application/vnd.librarysimplified.bearer-token+json')) {
    return { response };
  }

  const bodyText = await response.text().catch(() => '');
  let payload: any = null;
  try {
    payload = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    payload = null;
  }

  const accessToken = typeof payload?.access_token === 'string'
    ? payload.access_token
    : typeof payload?.accessToken === 'string'
      ? payload.accessToken
      : null;
  const tokenType = typeof payload?.token_type === 'string'
    ? payload.token_type
    : typeof payload?.tokenType === 'string'
      ? payload.tokenType
      : 'Bearer';
  const location = typeof payload?.location === 'string' ? payload.location : null;

  if (!accessToken || !location) {
    throw new Error('Import failed. The fulfill endpoint returned an incomplete bearer-token document.');
  }

  const resolvedLocation = new URL(location, response.url || fallbackUrl).href;
  const followUpAuth: RequestAuthorization | null = String(tokenType).toLowerCase() === 'bearer'
    ? {
        scheme: 'bearer',
        token: accessToken,
      }
    : null;
  if (String(tokenType).toLowerCase() === 'bearer') {
    cachePatronAuthorizationForUrl(resolvedLocation, followUpAuth);
  }
  const nextUrl = proxiedUrl(resolvedLocation);
  if (typeof nextUrl === 'string' && nextUrl.includes('corsproxy.io')) {
    throw new Error('Import failed. The follow-up download would use a public CORS proxy which may strip authorization headers. Configure an owned proxy (VITE_OWN_PROXY_URL).');
  }

  const followUpResponse = await fetch(nextUrl, {
    headers: {
      Authorization: `${tokenType} ${accessToken}`,
    },
    credentials: nextUrl === resolvedLocation ? 'include' : 'omit',
    redirect: 'follow',
  });

  if (!followUpResponse.ok) {
    throw new Error(`Import failed. The bearer-token follow-up download returned ${followUpResponse.status}.`);
  }

  return {
    response: followUpResponse,
    resolvedUrl: resolvedLocation,
    followUpAuth,
  };
};

const cacheAudiobookTrackAuthorization = (
  bookData: ArrayBuffer,
  manifestUrl: string | undefined,
  auth: RequestAuthorization | null | undefined,
) => {
  if (!manifestUrl || !auth || auth.scheme !== 'bearer') return;
  try {
    const manifest = parseAudiobookManifest(bookData, manifestUrl);
    manifest.tracks.forEach((track) => {
      cachePatronAuthorizationForUrl(track.href, auth);
    });
  } catch (error) {
    logger.debug('Skipping audiobook track auth cache after manifest parse failure', { error });
  }
};

const validateFulfillResponse = (
  response: Response,
  book: Pick<CatalogBook, 'title' | 'format'>,
) => {
  const contentType = getContentType(response).toLowerCase();
  if (!contentType) return;

  const looksLikeDocument = contentType.includes('json') || contentType.includes('xml') || contentType.includes('html');
  const allowsEpub = contentType.includes('application/epub') || contentType.includes('application/octet-stream') || contentType.includes('application/zip');
  const allowsPdf = contentType.includes('application/pdf') || contentType.includes('application/octet-stream');
  const allowsAudiobook = contentType.includes('application/audiobook+json')
    || contentType.includes('application/webpub+json')
    || contentType.includes('application/json');
  const normalizedFormat = (book.format || '').toUpperCase();

  if (normalizedFormat === 'EPUB' && looksLikeDocument && !allowsEpub) {
    throw new Error(`Import failed for "${book.title}". The fulfill endpoint returned ${contentType || 'a document response'} instead of a downloadable EPUB file.`);
  }

  if (normalizedFormat === 'PDF' && looksLikeDocument && !allowsPdf) {
    throw new Error(`Import failed for "${book.title}". The fulfill endpoint returned ${contentType || 'a document response'} instead of a downloadable PDF file.`);
  }

  if (normalizedFormat === 'AUDIOBOOK' && looksLikeDocument && !allowsAudiobook) {
    throw new Error(`Import failed for "${book.title}". The fulfill endpoint returned ${contentType || 'a document response'} instead of an audiobook manifest.`);
  }
};

export const useAuthAcquisitionCoordinator = ({
  processAndSaveBook,
  saveExternalReaderPlaceholder,
  setImportStatus,
  setActiveOpdsSource,
  setCurrentView,
  pushToast,
}: UseAuthAcquisitionCoordinatorOptions) => {
  const [credentialPrompt, setCredentialPrompt] = useState<CredentialPrompt>(initialCredentialPrompt);
  const [showNetworkDebug, setShowNetworkDebug] = useState(false);
  const isPalaceUrl = (url: string) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname.endsWith('palace.io')
        || hostname.endsWith('palaceproject.io')
        || hostname.endsWith('thepalaceproject.org')
        || hostname.endsWith('.palace.io')
        || hostname.endsWith('.thepalaceproject.org');
    } catch {
      return false;
    }
  };

  const openCredentialPromptForAction = useCallback((
    book: CatalogBook,
    catalogName: string | undefined,
    authDocument: any | null,
    pendingAction: 'import' | 'palace-borrow' | 'thorium-download',
  ) => {
    setImportStatus({ isLoading: false, message: '', error: null });
    setCredentialPrompt({
      isOpen: true,
      host: new URL(book.downloadUrl).host,
      pendingHref: book.downloadUrl,
      pendingBook: book,
      pendingCatalogName: catalogName,
      pendingAction,
      authDocument,
    });
  }, [setImportStatus]);

  const resolveCatalogAcquisition = useCallback(async (
    book: CatalogBook,
    catalogName: string | undefined,
    pendingAction: 'import' | 'palace-borrow' | 'thorium-download',
  ): Promise<{ success: true; finalUrl: string; requestAuth: RequestAuthorization | null; activeAuthDocument: any | null } | { success: false; pendingPrompt?: boolean; error?: string }> => {
    let finalUrl = book.downloadUrl;
    let requestAuth: RequestAuthorization | null = null;
    let activeAuthDocument = getCachedAuthDocumentForUrl(book.downloadUrl);

    if (!book.isOpenAccess) {
      const cred = await findCredentialForUrl(book.downloadUrl);
      const cachedTokenAuth = getCachedPatronAuthorizationForUrl(book.downloadUrl);
      requestAuth = cachedTokenAuth;

      if (!requestAuth && !cred && activeAuthDocument) {
        openCredentialPromptForAction(book, catalogName, activeAuthDocument, pendingAction);
        return { success: false, pendingPrompt: true };
      }

      if (!requestAuth && cred) {
        requestAuth = activeAuthDocument
          ? await getAuthorizationForAuthDocument(activeAuthDocument, book.downloadUrl, cred.username, cred.password)
          : {
            scheme: 'basic',
            username: cred.username,
            password: cred.password,
          };
      }

      const resolveResult = await opdsAcquisitionService.resolve(
        book.downloadUrl,
        (isPalaceUrl(book.downloadUrl) || requestAuth?.scheme === 'bearer') ? '1' : 'auto',
        requestAuth,
      );

      if (resolveResult.success) {
        finalUrl = resolveResult.data;
      } else {
        const errorResult = resolveResult as { success: false; error: string; status?: number; authDocument?: any };
        if (errorResult.status === 401 || errorResult.status === 403) {
          openCredentialPromptForAction(book, catalogName, errorResult.authDocument || activeAuthDocument || null, pendingAction);
          return { success: false, pendingPrompt: true };
        }
        if (!isPalaceUrl(book.downloadUrl)) {
          logger.warn('Failed to resolve acquisition chain, using original URL', errorResult.error);
        } else {
          logger.debug('Using original Palace fulfill URL after unresolved acquisition chain', {
            url: book.downloadUrl,
            error: errorResult.error,
          });
        }
      }
    }

    activeAuthDocument = getCachedAuthDocumentForUrl(book.downloadUrl);
    return { success: true, finalUrl, requestAuth, activeAuthDocument };
  }, [openCredentialPromptForAction]);

  const fetchResolvedCatalogResponse = useCallback(async (
    book: CatalogBook,
    finalUrl: string,
    requestAuthOverride?: RequestAuthorization | null,
  ) => {
    let proxyUrl = await maybeProxyForCors(finalUrl, book.isOpenAccess === true);
    const bearerAuth = requestAuthOverride?.scheme === 'bearer'
      ? requestAuthOverride
      : getCachedPatronAuthorizationForUrl(book.downloadUrl);
    const basicAuth = requestAuthOverride?.scheme === 'basic'
      ? requestAuthOverride
      : null;
    const storedCred = basicAuth ? null : await findCredentialForUrl(book.downloadUrl);
    const downloadHeaders: Record<string, string> = {};
    if (bearerAuth) {
      downloadHeaders.Authorization = buildAuthorizationHeader(bearerAuth);
    } else if (basicAuth) {
      downloadHeaders.Authorization = buildAuthorizationHeader(basicAuth);
    } else if (storedCred) {
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

    const resolvedFulfill = await resolveLibrarySimplifiedBearerTokenDocument(response, finalUrl);
    return {
      response: resolvedFulfill.response,
      resolvedFulfill,
      activeAuthDocument: getCachedAuthDocumentForUrl(book.downloadUrl),
    };
  }, []);

  const handleBorrowForPalace = useCallback(async (book: CatalogBook, catalogName?: string): Promise<ProtectedActionResult> => {
    setImportStatus({ isLoading: true, message: `Borrowing ${book.title} to Palace...`, error: null });
    try {
      const prepared = await resolveCatalogAcquisition(book, catalogName, 'palace-borrow');
      if (!prepared.success) {
        return { success: false, error: 'error' in prepared ? prepared.error : undefined };
      }
      await saveExternalReaderPlaceholder(book, catalogName, 'palace');
      setImportStatus({ isLoading: false, message: '', error: null });
      return { success: true, action: 'palace-borrow' };
    } catch (error) {
      logger.error('Error borrowing protected Palace title:', error);
      const message = error instanceof Error ? error.message : 'Borrow failed.';
      setImportStatus({ isLoading: false, message: '', error: message });
      return { success: false, error: message };
    }
  }, [resolveCatalogAcquisition, saveExternalReaderPlaceholder, setImportStatus]);

  const handleDownloadForThorium = useCallback(async (book: CatalogBook, catalogName?: string): Promise<ProtectedActionResult> => {
    setImportStatus({ isLoading: true, message: `Preparing ${book.title} for Thorium...`, error: null });
    try {
      const prepared = await resolveCatalogAcquisition(book, catalogName, 'thorium-download');
      if (!prepared.success) {
        return { success: false, error: 'error' in prepared ? prepared.error : undefined };
      }

      const downloadResult = await fetchResolvedCatalogResponse(book, prepared.finalUrl, prepared.requestAuth);
      const contentType = getContentType(downloadResult.response).toLowerCase();
      if (
        contentType
        && !contentType.includes('application/vnd.readium.lcp.license.v1.0+json')
        && !contentType.includes('readium.lcp')
        && !contentType.includes('+lcp')
        && !contentType.includes('application/octet-stream')
        && !contentType.includes('application/epub+zip')
        && !contentType.includes('application/pdf')
      ) {
        throw new Error(`Download failed for "${book.title}". The fulfill endpoint returned ${contentType} instead of an LCP-compatible file.`);
      }

      const blob = await downloadResult.response.blob();
      const fileName = inferProtectedDownloadFileName(downloadResult.response, book);
      triggerBrowserDownload(blob, fileName);
      setImportStatus({ isLoading: false, message: '', error: null });
      return { success: true, action: 'thorium-download' };
    } catch (error) {
      logger.error('Error preparing Thorium download:', error);
      const message = error instanceof Error ? error.message : 'Protected download failed.';
      setImportStatus({ isLoading: false, message: '', error: message });
      return { success: false, error: message };
    }
  }, [fetchResolvedCatalogResponse, resolveCatalogAcquisition, setImportStatus]);

  const handleImportFromCatalog = useCallback(async (book: CatalogBook, catalogName?: string): Promise<ImportResult> => {
    if (book.isLcpProtected) {
      const error = `Cannot import "${book.title}". This title is protected with Readium LCP, which is not supported by this application.`;
      setImportStatus({ isLoading: false, message: '', error });
      return { success: false };
    }

    if (book.isAdobeDrmProtected) {
      const error = `Cannot import "${book.title}". This title is protected with Adobe DRM, which is not supported by this application.`;
      setImportStatus({ isLoading: false, message: '', error });
      return { success: false };
    }

    if (book.format && !['EPUB', 'PDF', 'AUDIOBOOK'].includes(book.format.toUpperCase())) {
      const error = `Cannot import this book. The application currently supports EPUB, PDF, and audiobook manifests, but this book is a ${book.format}.`;
      setImportStatus({ isLoading: false, message: '', error });
      return { success: false };
    }

    setImportStatus({ isLoading: true, message: `Downloading ${book.title}...`, error: null });
    try {
      const prepared = await resolveCatalogAcquisition(book, catalogName, 'import');
      if (!prepared.success) {
        return { success: false };
      }

      const downloadResult = await fetchResolvedCatalogResponse(book, prepared.finalUrl, prepared.requestAuth);
      let response = downloadResult.response;
      const resolvedFulfill = downloadResult.resolvedFulfill;
      validateFulfillResponse(response, book);
      const activeAuthDocument = downloadResult.activeAuthDocument;

      const bookData = await response.arrayBuffer();
      if (book.format?.toUpperCase() === 'AUDIOBOOK') {
        cacheAudiobookTrackAuthorization(bookData, resolvedFulfill.resolvedUrl, resolvedFulfill.followUpAuth);
      }
      const catalogBookMeta = buildCatalogImportMeta(book, {
        resolvedDownloadUrl: resolvedFulfill.resolvedUrl || prepared.finalUrl,
        fulfillmentUrl: book.downloadUrl,
        authDocument: activeAuthDocument,
      });

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
      } else if (!result.existingBook) {
        setImportStatus({
          isLoading: false,
          message: '',
          error: 'Import failed after download. The fulfill endpoint may not have returned a directly importable EPUB or PDF file.',
        });
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
  }, [fetchResolvedCatalogResponse, processAndSaveBook, resolveCatalogAcquisition, setActiveOpdsSource, setCurrentView, setImportStatus]);

  const handleCredentialSubmit = useCallback(async (username: string, password: string, save: boolean) => {
    if (!credentialPrompt.pendingHref) {
      setCredentialPrompt(initialCredentialPrompt);
      return;
    }

    const href = credentialPrompt.pendingHref;
    try {
      const normalizedUsername = username.trim();
      const normalizedPassword = password.trim();
      let requestAuth: RequestAuthorization = {
        scheme: 'basic',
        username: normalizedUsername,
        password: normalizedPassword,
      };
      const activeAuthDocument = credentialPrompt.authDocument || getCachedAuthDocumentForUrl(href);

      if (activeAuthDocument) {
        requestAuth = await getAuthorizationForAuthDocument(activeAuthDocument, href, normalizedUsername, normalizedPassword);
      }

      const resolveResult = await opdsAcquisitionService.resolve(
        href,
        requestAuth.scheme === 'bearer' || isPalaceUrl(href) ? '1' : 'auto',
        requestAuth,
      );
      if (resolveResult.success && credentialPrompt.pendingBook) {
        const pendingAction = credentialPrompt.pendingAction || 'import';
        if (save && credentialPrompt.host) {
          saveOpdsCredential(credentialPrompt.host, normalizedUsername, normalizedPassword);
        }
        setCredentialPrompt(initialCredentialPrompt);

        if (pendingAction === 'palace-borrow') {
          setImportStatus({ isLoading: false, message: '', error: null });
          return;
        }

        if (pendingAction === 'thorium-download') {
          setImportStatus({ isLoading: true, message: `Preparing ${credentialPrompt.pendingBook.title} for Thorium...`, error: null });
          const downloadResult = await fetchResolvedCatalogResponse(credentialPrompt.pendingBook, resolveResult.data, requestAuth);
          const blob = await downloadResult.response.blob();
          const fileName = inferProtectedDownloadFileName(downloadResult.response, credentialPrompt.pendingBook);
          triggerBrowserDownload(blob, fileName);
          setImportStatus({ isLoading: false, message: '', error: null });
          return;
        }

        setImportStatus({ isLoading: true, message: `Downloading ${credentialPrompt.pendingBook.title}...`, error: null });
        const downloadResult = await fetchResolvedCatalogResponse(credentialPrompt.pendingBook, resolveResult.data, requestAuth);
        const finalResponse = downloadResult.response;
        const resolvedFulfill = downloadResult.resolvedFulfill;
        validateFulfillResponse(finalResponse, credentialPrompt.pendingBook);
        const bookData = await finalResponse.arrayBuffer();
        if (credentialPrompt.pendingBook.format?.toUpperCase() === 'AUDIOBOOK') {
          cacheAudiobookTrackAuthorization(bookData, resolvedFulfill.resolvedUrl, resolvedFulfill.followUpAuth);
        }
        const importResult = await processAndSaveBook(
          bookData,
          credentialPrompt.pendingBook.title,
          credentialPrompt.pendingBook.author,
          'catalog',
          credentialPrompt.pendingCatalogName,
          credentialPrompt.pendingBook.providerId,
          credentialPrompt.pendingBook.format,
          credentialPrompt.pendingBook.coverImage,
          buildCatalogImportMeta(credentialPrompt.pendingBook, {
            resolvedDownloadUrl: resolvedFulfill.resolvedUrl || credentialPrompt.pendingBook.downloadUrl,
            fulfillmentUrl: credentialPrompt.pendingBook.downloadUrl,
            authDocument: activeAuthDocument,
          }),
        );
        if (!importResult.success && importResult.existingBook) {
          setImportStatus({
            isLoading: false,
            message: '',
            error: `A book with the same identifier is already in your library: "${importResult.existingBook.title}".`,
          });
        } else if (!importResult.success) {
          setImportStatus({
            isLoading: false,
            message: '',
            error: 'Import failed after download. The fulfill endpoint may not have returned a directly importable EPUB or PDF file.',
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
  }, [credentialPrompt, fetchResolvedCatalogResponse, processAndSaveBook, setImportStatus]);

  const handleOpenAuthLink = useCallback((href: string) => {
    void href;
    // Intentionally no-op. Opening is handled by the credentials modal.
  }, []);

  const handleRetryAfterProviderLogin = useCallback(async () => {
    if (!credentialPrompt.pendingHref || !credentialPrompt.pendingBook) return;
    const pendingAction = credentialPrompt.pendingAction || 'import';
    setImportStatus({
      isLoading: true,
      message: pendingAction === 'palace-borrow'
        ? 'Retrying Palace borrow after provider login...'
        : pendingAction === 'thorium-download'
          ? 'Retrying protected download after provider login...'
          : 'Retrying download after provider login...',
      error: null,
    });
    try {
      const resolveResult = await opdsAcquisitionService.resolve(credentialPrompt.pendingHref, 'auto', null);
      if (!resolveResult.success) {
        throw new Error('Failed to resolve after login');
      }

      if (pendingAction === 'palace-borrow') {
        setImportStatus({ isLoading: false, message: '', error: null });
        setCredentialPrompt(initialCredentialPrompt);
        return;
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

      if (pendingAction === 'thorium-download') {
        const resolvedFulfill = await resolveLibrarySimplifiedBearerTokenDocument(response, resolveResult.data);
        const blob = await resolvedFulfill.response.blob();
        const fileName = inferProtectedDownloadFileName(resolvedFulfill.response, credentialPrompt.pendingBook);
        triggerBrowserDownload(blob, fileName);
        setCredentialPrompt(initialCredentialPrompt);
        setImportStatus({ isLoading: false, message: '', error: null });
        return;
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
        buildCatalogImportMeta(credentialPrompt.pendingBook, {
          resolvedDownloadUrl: credentialPrompt.pendingBook.downloadUrl,
          fulfillmentUrl: credentialPrompt.pendingBook.downloadUrl,
          authDocument: credentialPrompt.authDocument || getCachedAuthDocumentForUrl(credentialPrompt.pendingBook.downloadUrl),
        }),
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
    handleBorrowForPalace,
    handleDownloadForThorium,
    handleCredentialSubmit,
    handleOpenAuthLink,
    handleRetryAfterProviderLogin,
    showNetworkDebug,
    setShowNetworkDebug,
  };
};
