import React, { useRef } from 'react';

import { bookmarkService } from '../domain/reader';
import { citationService } from '../domain/reader/citation-service';
import type { BookMetadata, BookRecord, Bookmark, CatalogBook, Citation, ImportStatus } from '../types';

// Helper type to allow both library and catalog records in detail view
export type BookDetailMetadata = BookMetadata | CatalogBook;

type LegacyImportStatus = {
  isLoading: boolean;
  message: string;
  error: string | null;
};

// Unified props interface (fixes type errors)
export interface BookDetailViewProps {
  book: BookDetailMetadata;
  source: 'library' | 'catalog' | string;
  catalogName?: string;
  relatedSeriesBooks?: CatalogBook[];
  onShowRelatedCatalogBook?: (book: CatalogBook, relatedSeriesBooks?: CatalogBook[]) => void;
  onOpenRelatedCatalogFeed?: (title: string, url: string) => void;
  onBack: () => void;
  onReadBook: (book: BookDetailMetadata) => void;
  onImportFromCatalog?: (book: CatalogBook | BookDetailMetadata, catalogName?: string) => Promise<{ success: boolean; bookRecord?: BookRecord; existingBook?: BookRecord }>;
  onBorrowForPalace?: (book: CatalogBook, catalogName?: string) => Promise<{ success: boolean; action?: 'palace-borrow' | 'thorium-download'; error?: string }>;
  onDownloadForThorium?: (book: CatalogBook, catalogName?: string) => Promise<{ success: boolean; action?: 'palace-borrow' | 'thorium-download'; error?: string }>;
  importStatus?: ImportStatus | LegacyImportStatus;
  setImportStatus?: ((status: ImportStatus) => void) | React.Dispatch<React.SetStateAction<LegacyImportStatus>>;
  userCitationFormat?: 'apa' | 'mla' | 'chicago' | string;
}

import { LeftArrowIcon } from './icons';
import AccessibilityBadges from './library/shared/AccessibilityBadges';
import SeriesLane from './library/catalog/SeriesLane';
import BookBadges from './library/shared/BookBadges';
import { getReaderLabel } from './library/shared/externalReader';
import PalaceLogoIcon from './library/shared/PalaceLogoIcon';
import { db, ensureFreshPatronAuthorization, findCredentialForUrl } from '../services';

const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  (e.target as HTMLImageElement).src = '/default-cover.png';
};

const isPalaceHostedUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
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

// Utility: format date for display
const formatDate = (dateString: string | number): string => {
  const date = new Date(typeof dateString === 'number' ? dateString : dateString);
  if (isNaN(date.getTime())) return String(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

const formatPublicationDate = (dateString: string | number | undefined): string | undefined => {
  if (!dateString) return undefined;
  const date = new Date(typeof dateString === 'number' ? dateString : dateString);
  if (isNaN(date.getTime())) return String(dateString);
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

const sanitizeDescriptionHtml = (rawText: string): string => {
  if (!rawText.includes('<')) {
    return rawText;
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return rawText
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${rawText}</div>`, 'text/html');
  const allowedTags = new Set(['P', 'BR', 'EM', 'STRONG', 'B', 'I', 'UL', 'OL', 'LI']);

  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (!allowedTags.has(element.tagName)) {
        const fragment = document.createDocumentFragment();
        while (element.firstChild) {
          fragment.appendChild(element.firstChild);
        }
        element.replaceWith(fragment);
        Array.from(fragment.childNodes).forEach(sanitizeNode);
        return;
      }

      Array.from(element.attributes).forEach((attribute) => {
        element.removeAttribute(attribute.name);
      });
    }

    Array.from(node.childNodes).forEach(sanitizeNode);
  };

  const container = doc.body.firstElementChild;
  if (!container) return rawText;

  Array.from(container.childNodes).forEach(sanitizeNode);
  return container.innerHTML;
};

const DetailField: React.FC<{
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}> = ({ label, children, compact = false }) => (
  <div className={`space-y-1 ${compact ? '' : 'pb-1'}`}>
    <p className="theme-text-primary text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>
    <div className="theme-text-secondary text-sm leading-6">{children}</div>
  </div>
);

// BookAnnotationsAside component
const BookAnnotationsAside: React.FC<{
  libraryBook: BookMetadata;
  bookmarks: Bookmark[];
  citations: Citation[];
  userCitationFormat: 'apa' | 'mla' | 'chicago' | string;
  className?: string;
}> = ({ libraryBook, bookmarks = [], citations = [], userCitationFormat, className = '' }) => {
  function downloadTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }
  return (
    <section className={`space-y-6 ${className}`.trim()}>
      <div>
        <div className="theme-border theme-surface rounded-lg border p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="theme-text-primary text-sm font-semibold">Bookmarks</h3>
            <span className="theme-accent-badge inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
              Saved
            </span>
          </div>
        {bookmarks.length > 0 ? (
          <ul className="space-y-2">
            {bookmarks.map((bm, idx) => (
              <li key={bm.id || idx} className="theme-surface-elevated rounded-lg p-3">
                <div className="space-y-2">
                  <DetailField label="Bookmark" compact>
                    <span className="theme-text-primary font-semibold">{bm.label || `Bookmark ${idx + 1}`}</span>
                  </DetailField>
                  {bm.description && (
                    <DetailField label="Note" compact>
                      {bm.description}
                    </DetailField>
                  )}
                  {bm.chapter && (
                    <DetailField label="Chapter" compact>
                      {bm.chapter}
                    </DetailField>
                  )}
                  <DetailField label="Created" compact>
                    <span className="theme-text-muted">{formatDate(bm.createdAt)}</span>
                  </DetailField>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="theme-text-muted text-sm">No bookmarks yet.</div>
        )}
        </div>
      </div>
      <div>
        <div className="theme-border theme-surface rounded-lg border p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="theme-text-primary text-sm font-semibold">Citations</h3>
            <button
              className="theme-button-primary ml-2 rounded px-3 py-1 text-xs font-bold"
              onClick={() => {
                const ris = citations.map(c => `${c.note || ''} [${c.chapter || ''}${c.pageNumber ? ', p.' + c.pageNumber : ''}]`).join('\n');
                downloadTextFile(`${libraryBook.title || 'citations'}.ris`, ris);
              }}
            >
              Export to RIS
            </button>
          </div>
        {citations.length > 0 ? (
          <ul className="space-y-2">
            {citations.map((ct, idx) => {
              // Use the citation's formatType (citationFormat) as set by the user in Reader Views
              const rawCitationFormat = ct.citationFormat || userCitationFormat || 'apa';
              const citationFormat = rawCitationFormat === 'mla' ? 'mla' : 'apa';
              const formatted = citationService.formatCitation(libraryBook, ct, citationFormat);
              return (
                <li key={ct.id || idx} className="theme-surface-elevated rounded-lg p-3">
                  <div className="space-y-2">
                    <DetailField label="Citation" compact>
                      <span className="theme-text-primary font-semibold">{formatted.text}</span>
                    </DetailField>
                    {ct.note && (
                      <DetailField label="Note" compact>
                        {ct.note}
                      </DetailField>
                    )}
                    {(ct.chapter || ct.pageNumber) && (
                      <DetailField label="Location" compact>
                        <div className="space-y-1">
                          {ct.chapter && <div>{ct.chapter}</div>}
                          {ct.pageNumber && <div>Page {ct.pageNumber}</div>}
                        </div>
                      </DetailField>
                    )}
                    <DetailField label="Created" compact>
                      <span className="theme-text-muted">{formatDate(ct.createdAt)}</span>
                    </DetailField>
                    <span className="theme-accent-badge inline-block rounded border px-2 py-0.5 text-xs font-bold">{formatted.format.toUpperCase()}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="theme-text-muted text-sm">No citations yet.</div>
        )}
        </div>
      </div>
    </section>
  );
};

interface AnimationData {
  rect: { x: number; y: number; width: number; height: number; top: number; right: number; bottom: number; left: number };
  coverImage?: string;
}

interface PrimaryActionState {
  label: string;
  disabled: boolean;
}

interface PrimaryActionNotice {
  tone: 'default' | 'warning';
  message: string;
}

type DetailTabKey = 'bibliographic' | 'accessibility' | 'related' | 'annotations';

const getLibraryPrimaryActionState = (
  normalizedFormat: string,
  isPreparingPlayback: boolean,
  isSyncedPlaceholder: boolean,
  requiresReauthorization: boolean,
  externalReaderApp?: 'palace' | 'thorium',
): PrimaryActionState => {
  if (externalReaderApp === 'palace') {
    return {
      label: getReaderLabel(externalReaderApp),
      disabled: false,
    };
  }

  if (externalReaderApp === 'thorium') {
    return {
      label: getReaderLabel(externalReaderApp),
      disabled: false,
    };
  }

  if (isSyncedPlaceholder) {
    return {
      label: requiresReauthorization ? 'Reauthorize Access Required' : 'Re-download to Read',
      disabled: true,
    };
  }

  if (isPreparingPlayback) {
    return {
      label: 'Refreshing Access...',
      disabled: false,
    };
  }

  return {
    label: normalizedFormat === 'AUDIOBOOK' ? 'Listen' : 'Read Book',
    disabled: false,
  };
};

const getCatalogPrimaryActionState = (
  isImporting: boolean,
  isAlreadyInLibrary: boolean,
  isImportable: boolean,
  drmBlockReason: string | null,
): PrimaryActionState => {
  if (isImporting) {
    return {
      label: 'Importing...',
      disabled: true,
    };
  }

  if (isAlreadyInLibrary) {
    return {
      label: 'Already in My Shelf',
      disabled: true,
    };
  }

  if (!isImportable) {
    return {
      label: drmBlockReason ? `Cannot Import: ${drmBlockReason}` : 'Cannot Import: Unsupported format',
      disabled: true,
    };
  }

  return {
    label: 'Import to My Shelf',
    disabled: false,
  };
};

const getPrimaryActionNotice = (
  source: string,
  isAlreadyInLibrary: boolean,
  isContentExcludedFromSync: boolean,
  requiresReauthorization: boolean,
  restoredFromSync: boolean,
  externalReaderApp: 'palace' | 'thorium' | undefined,
  providerName: string | undefined,
  hasCatalogCredential: boolean | null,
  drmBlockReason: string | null,
  isLcpProtected: boolean,
): PrimaryActionNotice | null => {
  if (source === 'catalog' && isAlreadyInLibrary) {
    return {
      tone: 'default',
      message: 'This title is already in My Shelf.',
    };
  }

  if (source === 'library' && isContentExcludedFromSync && requiresReauthorization && restoredFromSync) {
    return {
      tone: 'warning',
      message: hasCatalogCredential
        ? `This synced loan title needs fresh authorization. You already have saved credentials for ${providerName || 'this library'} on this device. Re-open the source catalog or loans feed to restore access.`
        : `This synced loan title needs fresh authorization. Sign in to ${providerName || 'the source library'} in Catalog or Loans, then restore access on this device.`,
    };
  }

  if (source === 'library' && isContentExcludedFromSync && restoredFromSync) {
    return {
      tone: 'warning',
      message: 'This protected title was synced as a record only. Re-download it from its source to read it on this device.',
    };
  }

  if (source === 'library' && externalReaderApp === 'palace') {
    return {
      tone: 'default',
      message: 'This title was borrowed to your Palace account. Open the Palace app to read it.',
    };
  }

  if (source === 'library' && externalReaderApp === 'thorium') {
    return {
      tone: 'default',
      message: 'This title is intended for Thorium Reader. Open it there to continue reading.',
    };
  }

  if (source === 'catalog' && drmBlockReason) {
    return {
      tone: 'warning',
      message: isLcpProtected
        ? 'This title is protected with Readium LCP and cannot be imported by this application.'
        : 'This title is protected with Adobe DRM and cannot be imported by this application.',
    };
  }

  return null;
};

const BookDetailView: React.FC<BookDetailViewProps> = ({ book, onBack, source, catalogName, relatedSeriesBooks, onShowRelatedCatalogBook, onOpenRelatedCatalogFeed, userCitationFormat = 'apa', onReadBook, onImportFromCatalog, onBorrowForPalace, onDownloadForThorium, importStatus, setImportStatus }) => {
  const bookAny = book as any;
  const publisherText = typeof bookAny.publisher === 'string' ? bookAny.publisher : undefined;
  const publicationDateText = formatPublicationDate(bookAny.publicationDate);
  const descriptionText = (bookAny.description || bookAny.summary || '') as string;
  const descriptionHtml = React.useMemo(
    () => (descriptionText ? sanitizeDescriptionHtml(descriptionText) : ''),
    [descriptionText],
  );
  const libraryBookForAnnotations: BookMetadata = {
    id: bookAny.id ?? 0,
    title: book.title,
    author: book.author,
    coverImage: book.coverImage,
    publisher: publisherText,
    publicationDate: bookAny.publicationDate,
    providerId: bookAny.providerId,
    providerName: bookAny.providerName,
    description: bookAny.description ?? bookAny.summary ?? undefined,
    subjects: bookAny.subjects,
    format: bookAny.format,
    isbn: bookAny.isbn,
    language: bookAny.language,
    rights: bookAny.rights,
    identifiers: Array.isArray(bookAny.identifiers)
      ? bookAny.identifiers.map((id: any) => (typeof id === 'string' ? id : id?.value)).filter(Boolean)
      : undefined,
    opfRaw: bookAny.opfRaw,
    accessModes: bookAny.accessModes,
    accessModesSufficient: bookAny.accessModesSufficient,
    accessibilityFeatures: bookAny.accessibilityFeatures,
    hazards: bookAny.hazards,
    accessibilitySummary: bookAny.accessibilitySummary,
    certificationConformsTo: bookAny.certificationConformsTo,
    certification: bookAny.certification,
    accessibilityFeedback: bookAny.accessibilityFeedback,
  };
  const [localBookmarks, setLocalBookmarks] = React.useState<Bookmark[]>([]);
  const [localCitations, setLocalCitations] = React.useState<Citation[]>([]);
  const primarySeries = 'downloadUrl' in book && Array.isArray(book.series) ? book.series[0] : undefined;
  const relatedCatalogLinks = 'downloadUrl' in book && Array.isArray(book.relatedLinks) ? book.relatedLinks : [];
  const collectionTitles = Array.isArray(bookAny.collections)
    ? Array.from(new Set(
      bookAny.collections
        .map((collection: any) => String(collection?.title || '').trim())
        .filter((title: string) => title.length > 0),
    ))
    : [];
  const relatedFeedLinks = React.useMemo(() => {
    if (!('downloadUrl' in book)) {
      return [] as Array<{ title: string; url: string; rel: string; type?: string }>;
    }

    const opds2SeriesLinks = Array.isArray(book.series)
      ? book.series
        .filter((series) => typeof series?.url === 'string' && series.url.trim().length > 0)
        .map((series) => ({
          title: `Same Series: ${series.name}`,
          url: String(series.url),
          rel: 'series',
          type: 'application/opds+json',
        }))
      : [];

    const opds2CollectionLinks = Array.isArray(book.collections)
      ? book.collections
        .filter((collection) => (
          collection?.source === 'belongsTo'
          && typeof collection?.href === 'string'
          && collection.href.trim().length > 0
        ))
        .map((collection) => ({
          title: collection.title,
          url: collection.href,
          rel: 'collection',
          type: 'application/opds+json',
        }))
      : [];

    return [...relatedCatalogLinks, ...opds2SeriesLinks, ...opds2CollectionLinks]
      .filter((link, index, collection) => collection.findIndex((candidate) => candidate.url === link.url) === index);
  }, [book, relatedCatalogLinks]);
  const seriesBooksForLane = source === 'catalog'
    && primarySeries
    && Array.isArray(relatedSeriesBooks)
    && relatedSeriesBooks.length > 1
      ? relatedSeriesBooks
      : null;
  const hasRelatedWorksSection = relatedFeedLinks.length > 0 || Boolean(primarySeries && seriesBooksForLane);

  React.useEffect(() => {
    if (bookAny.id) {
      const result = bookmarkService.findByBookId(bookAny.id);
      if (result.success) setLocalBookmarks(result.data);
    }
  }, [bookAny.id]);

  React.useEffect(() => {
    if (bookAny.id) {
      const result = citationService.findByBookId(bookAny.id);
      if (result.success) setLocalCitations(result.data);
    }
  }, [bookAny.id]);
  const coverRef = useRef<HTMLImageElement>(null);
  const normalizedFormat = book.format?.toUpperCase() || '';
  const effectiveMediaType = (bookAny.mediaType || bookAny.acquisitionMediaType || '') as string;
  const normalizedMediaType = effectiveMediaType.toLowerCase();
  const [isPreparingPlayback, setIsPreparingPlayback] = React.useState(false);
  const [playbackNotice, setPlaybackNotice] = React.useState<string | null>(null);
  const audiobookSourceUrl = (bookAny.fulfillmentUrl || bookAny.sourceUrl || bookAny.providerId || '') as string;

  const prepareAudiobookPlayback = React.useCallback(async (announceOnlyWhenRefreshing: boolean) => {
    if (source !== 'library' || normalizedFormat !== 'AUDIOBOOK' || !audiobookSourceUrl) {
      return true;
    }

    setIsPreparingPlayback(true);
    setPlaybackNotice(null);
    try {
      const shouldAnnounceRefresh = announceOnlyWhenRefreshing;
      if (shouldAnnounceRefresh && setImportStatus) {
        (setImportStatus as React.Dispatch<React.SetStateAction<LegacyImportStatus>>)({
          isLoading: true,
          message: 'Checking audiobook access...',
          error: null,
        });
      }

      const result = await ensureFreshPatronAuthorization(audiobookSourceUrl);
      if (result.refreshed) {
        setPlaybackNotice('Refreshing audiobook access token...');
        if (setImportStatus) {
          (setImportStatus as React.Dispatch<React.SetStateAction<LegacyImportStatus>>)({
            isLoading: true,
            message: 'Refreshing audiobook access token...',
            error: null,
          });
        }
        window.setTimeout(() => {
          setPlaybackNotice('Audiobook access refreshed.');
          window.setTimeout(() => setPlaybackNotice(null), 2500);
        }, 250);
      } else if (setImportStatus) {
        (setImportStatus as React.Dispatch<React.SetStateAction<LegacyImportStatus>>)({
          isLoading: false,
          message: '',
          error: null,
        });
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh audiobook access.';
      setPlaybackNotice(message);
      if (setImportStatus) {
        (setImportStatus as React.Dispatch<React.SetStateAction<LegacyImportStatus>>)({
          isLoading: false,
          message: '',
          error: message,
        });
      }
      return false;
    } finally {
      if (setImportStatus) {
        window.setTimeout(() => {
          (setImportStatus as React.Dispatch<React.SetStateAction<LegacyImportStatus>>)({
            isLoading: false,
            message: '',
            error: null,
          });
        }, 500);
      }
      setIsPreparingPlayback(false);
    }
  }, [audiobookSourceUrl, normalizedFormat, setImportStatus, source]);

  React.useEffect(() => {
    void prepareAudiobookPlayback(false);
  }, [prepareAudiobookPlayback]);

  const handleReadClick = async () => {
    if (externalReaderApp === 'palace') {
      window.open('https://thepalaceproject.org/app/', '_blank', 'noopener,noreferrer');
      return;
    }

    if (externalReaderApp === 'thorium') {
      window.open('https://thorium.edrlab.org/', '_blank', 'noopener,noreferrer');
      return;
    }

    if (restoredFromSync && isContentExcludedFromSync) {
      return;
    }
    if (onReadBook && bookAny.id) {
      const ready = await prepareAudiobookPlayback(true);
      if (!ready) return;
      onReadBook(book);
    }
  };
  // Import button state and modal
  const [showImportSuccess, setShowImportSuccess] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isAlreadyInLibrary, setIsAlreadyInLibrary] = React.useState(false);
  const [hasCatalogCredential, setHasCatalogCredential] = React.useState<boolean | null>(null);
  const [protectedActionState, setProtectedActionState] = React.useState<'idle' | 'working' | 'palace-borrowed' | 'thorium-downloaded'>('idle');
  const [protectedActionMessage, setProtectedActionMessage] = React.useState<string | null>(null);
  const [protectedActionError, setProtectedActionError] = React.useState<string | null>(null);
  const isContentExcludedFromSync = Boolean(bookAny.contentExcludedFromSync);
  const requiresReauthorization = Boolean(bookAny.requiresReauthorization);
  const restoredFromSync = Boolean(bookAny.restoredFromSync);
  const externalReaderApp = (bookAny.externalReaderApp || undefined) as 'palace' | 'thorium' | undefined;
  const isSyncedPlaceholder = restoredFromSync && isContentExcludedFromSync;
  const hasSupportedBookFormat = normalizedFormat === 'PDF' || normalizedFormat === 'EPUB' || normalizedFormat === 'AUDIOBOOK';
  const hasSupportedBookMediaType =
    normalizedMediaType === 'application/pdf'
    || normalizedMediaType === 'application/epub+zip'
    || normalizedMediaType === 'application/audiobook+json'
    || normalizedMediaType === 'application/webpub+json';
  const isLcpProtected = Boolean(bookAny.isLcpProtected)
    || normalizedMediaType.includes('readium.lcp')
    || normalizedMediaType.includes('+lcp')
    || normalizedMediaType.includes('license.status')
    || (Array.isArray(bookAny.alternativeFormats) && bookAny.alternativeFormats.some((format: any) => {
      const mediaType = String(format?.mediaType || '').toLowerCase();
      return mediaType.includes('readium.lcp') || mediaType.includes('+lcp') || mediaType.includes('license.status');
    }));
  const isAdobeDrmProtected = Boolean(bookAny.isAdobeDrmProtected)
    || normalizedMediaType.includes('application/adobe+epub')
    || normalizedMediaType.includes('adobe.adept')
    || (Array.isArray(bookAny.alternativeFormats) && bookAny.alternativeFormats.some((format: any) => {
      const mediaType = String(format?.mediaType || '').toLowerCase();
      return mediaType.includes('application/adobe+epub') || mediaType.includes('adobe.adept');
    }));
  const drmBlockReason = isLcpProtected
    ? 'LCP Protected'
    : isAdobeDrmProtected
      ? 'Adobe DRM'
      : null;
  const isPalaceCatalog = source === 'catalog' && isPalaceHostedUrl(('downloadUrl' in book ? book.downloadUrl : '') as string);
  const usesPalaceProtectedAction = source === 'catalog' && isPalaceCatalog && (isLcpProtected || isAdobeDrmProtected);
  const usesThoriumProtectedAction = source === 'catalog' && !isPalaceCatalog && isLcpProtected;
  const usesExternalProtectedAction = usesPalaceProtectedAction || usesThoriumProtectedAction;
  const blockedDrmReason = !usesExternalProtectedAction ? drmBlockReason : (!isPalaceCatalog && isAdobeDrmProtected ? 'Adobe DRM' : null);

  // Only allow import if format or mediaType is PDF or EPUB
  const isImportable = (() => {
    if (blockedDrmReason) return false;
    return hasSupportedBookFormat || hasSupportedBookMediaType;
  })();
  const primaryAction = source === 'library'
    ? getLibraryPrimaryActionState(normalizedFormat, isPreparingPlayback, isSyncedPlaceholder, requiresReauthorization, externalReaderApp)
    : usesExternalProtectedAction
      ? {
        label: protectedActionState === 'working'
          ? usesPalaceProtectedAction
            ? 'Borrowing for Palace...'
            : 'Preparing Thorium Download...'
          : usesPalaceProtectedAction
            ? (protectedActionState === 'palace-borrowed' ? 'Open Palace App' : 'Borrow for Palace')
            : (protectedActionState === 'thorium-downloaded' ? 'Download Again' : 'Download for Thorium'),
        disabled: protectedActionState === 'working',
      }
      : getCatalogPrimaryActionState(isImporting, isAlreadyInLibrary, isImportable, blockedDrmReason);
  const primaryActionNotice = usesExternalProtectedAction
    ? {
      tone: protectedActionError ? 'warning' : 'default',
      message: protectedActionError || protectedActionMessage || (
        usesPalaceProtectedAction
          ? 'This protected title will be borrowed to your Palace account. Read it in the Palace app after borrowing.'
          : 'This title cannot be read in MeBooks. Download the LCP file and open it in Thorium Reader.'
      ),
    } as PrimaryActionNotice
    : getPrimaryActionNotice(
      source,
      isAlreadyInLibrary,
      isContentExcludedFromSync,
      requiresReauthorization,
      restoredFromSync,
      externalReaderApp,
      bookAny.providerName,
      hasCatalogCredential,
      blockedDrmReason,
      isLcpProtected,
    );
  const showPalacePrimaryActionIcon = (source === 'library' && externalReaderApp === 'palace')
    || (source === 'catalog' && usesPalaceProtectedAction);
  const useAudiobookCoverContain = normalizedFormat === 'AUDIOBOOK';
  const [activeDetailTab, setActiveDetailTab] = React.useState<DetailTabKey>('bibliographic');

  React.useEffect(() => {
    setProtectedActionState('idle');
    setProtectedActionMessage(null);
    setProtectedActionError(null);
  }, [bookAny.providerId, book.title, source]);

  React.useEffect(() => {
    let cancelled = false;

    const checkExistingImport = async () => {
      if (source !== 'catalog' || !bookAny.providerId) {
        if (!cancelled) setIsAlreadyInLibrary(false);
        return;
      }

      try {
        const existing = await db.findBookByIdentifier(bookAny.providerId);
        if (!cancelled) {
          setIsAlreadyInLibrary(Boolean(existing));
        }
      } catch {
        if (!cancelled) {
          setIsAlreadyInLibrary(false);
        }
      }
    };

    void checkExistingImport();

    return () => {
      cancelled = true;
    };
  }, [bookAny.providerId, source]);

  React.useEffect(() => {
    let cancelled = false;

    const checkCatalogCredential = async () => {
      if (source !== 'library' || !isSyncedPlaceholder || !requiresReauthorization) {
        if (!cancelled) setHasCatalogCredential(null);
        return;
      }

      const contextUrl = (bookAny.fulfillmentUrl || bookAny.sourceUrl || bookAny.manifestUrl || '') as string;
      if (!contextUrl) {
        if (!cancelled) setHasCatalogCredential(false);
        return;
      }

      try {
        const credential = await findCredentialForUrl(contextUrl);
        if (!cancelled) {
          setHasCatalogCredential(Boolean(credential));
        }
      } catch {
        if (!cancelled) {
          setHasCatalogCredential(false);
        }
      }
    };

    void checkCatalogCredential();

    return () => {
      cancelled = true;
    };
  }, [bookAny.fulfillmentUrl, bookAny.manifestUrl, bookAny.sourceUrl, isSyncedPlaceholder, requiresReauthorization, source]);

  const handleImportClick = async () => {
    if (isImporting || isAlreadyInLibrary) return;
    setIsImporting(true);
    if (onImportFromCatalog) {
      const result = await onImportFromCatalog(book as CatalogBook, catalogName);
      if (result.success) {
        setIsAlreadyInLibrary(true);
        setShowImportSuccess(true);
      } else if (result.existingBook && setImportStatus) {
        setIsAlreadyInLibrary(true);
        (setImportStatus as React.Dispatch<React.SetStateAction<LegacyImportStatus>>)({
          isLoading: false,
          message: '',
          error: `A book with the same identifier is already in your library: "${result.existingBook.title}".`,
        });
      }
    }
    setIsImporting(false);
  };

  const handleProtectedActionClick = async () => {
    if (source !== 'catalog' || !('downloadUrl' in book) || protectedActionState === 'working') return;

    if (usesPalaceProtectedAction && protectedActionState === 'palace-borrowed') {
      window.open('https://thepalaceproject.org/app/', '_blank', 'noopener,noreferrer');
      return;
    }

    setProtectedActionState('working');
    setProtectedActionError(null);
    setProtectedActionMessage(null);

    if (usesPalaceProtectedAction && onBorrowForPalace) {
      const result = await onBorrowForPalace(book as CatalogBook, catalogName);
      if (result.success) {
        setProtectedActionState('palace-borrowed');
        setProtectedActionMessage('Borrow complete. This title is now on your Palace shelf. Open the Palace app and read it there.');
      } else {
        setProtectedActionState('idle');
        setProtectedActionError(result.error || 'Borrow failed.');
      }
      return;
    }

    if (usesThoriumProtectedAction && onDownloadForThorium) {
      const result = await onDownloadForThorium(book as CatalogBook, catalogName);
      if (result.success) {
        setProtectedActionState('thorium-downloaded');
        setProtectedActionMessage('Downloaded the protected file. Open it in Thorium Reader to continue.');
      } else {
        setProtectedActionState('idle');
        setProtectedActionError(result.error || 'Protected download failed.');
      }
      return;
    }

    setProtectedActionState('idle');
    setProtectedActionError('This protected action is not available.');
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start px-4 md:px-12 md:pr-16 theme-text-primary">
      {/* Left column: cover, buttons, bookmarks, citations */}
      <div className="md:w-1/3 flex-shrink-0">
        <BookDetailHeader onBack={onBack} source={source as 'library' | 'catalog'} />
        <div className="mb-10" />
        <div className="mb-6 flex flex-col items-center">
          {book.coverImage ? (
            <img
              ref={coverRef}
              src={book.coverImage}
              alt={book.title}
              className={`mb-4 h-auto w-full max-w-xs rounded-lg shadow-2xl aspect-[2/3] ${useAudiobookCoverContain ? 'object-contain p-3 theme-surface-elevated' : 'object-cover'}`}
              onError={handleImgError}
            />
          ) : (
            <div className="theme-surface-elevated theme-text-muted aspect-[2/3] flex w-full max-w-xs items-center justify-center rounded-lg p-4 text-center shadow-2xl">
              <span className="font-semibold">{book.title}</span>
            </div>
          )}
          <button
            className="theme-button-primary mt-2 inline-flex items-center justify-center gap-2 rounded px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-60"
            onClick={
              source === 'library'
                ? handleReadClick
                : usesExternalProtectedAction
                  ? handleProtectedActionClick
                  : handleImportClick
            }
            disabled={primaryAction.disabled}
          >
            {showPalacePrimaryActionIcon && <PalaceLogoIcon className="h-4 w-4 flex-shrink-0 text-current" />}
            <span>{primaryAction.label}</span>
          </button>
          {source === 'catalog' && usesPalaceProtectedAction && (
            <a
              className="theme-button-secondary mt-2 rounded px-4 py-2 text-sm font-semibold"
              href="https://thepalaceproject.org/app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Palace App
            </a>
          )}
          {source === 'catalog' && usesThoriumProtectedAction && (
            <a
              className="theme-button-secondary mt-2 rounded px-4 py-2 text-sm font-semibold"
              href="https://thorium.edrlab.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Thorium Reader
            </a>
          )}
          {primaryActionNotice && (
            <div className={`${primaryActionNotice.tone === 'warning' ? 'theme-text-warning' : 'theme-text-secondary'} mt-3 max-w-xs text-center text-sm`}>
              {primaryActionNotice.message}
            </div>
          )}
          {showImportSuccess && (
            <div className="fixed inset-0 flex items-center justify-center z-50">
              <div className="theme-surface-elevated theme-border theme-text-primary flex flex-col items-center rounded-lg border p-8 shadow-2xl">
                <h2 className="theme-text-primary mb-4 text-2xl font-bold">Import Successful!</h2>
                <p className="theme-text-secondary mb-6">The book has been imported to your library.</p>
                <button className="theme-button-primary rounded px-4 py-2 font-bold" onClick={() => setShowImportSuccess(false)}>
                  Close
                </button>
              </div>
            </div>
          )}
          {playbackNotice && source === 'library' && normalizedFormat === 'AUDIOBOOK' && (
            <div className="theme-text-secondary mt-3 text-center text-sm">{playbackNotice}</div>
          )}
        </div>
      </div>
      {/* Right column: Book Details */}
      <div className="md:w-2/3 mt-8 md:mt-0">
        {/* Book Title, Author, Publisher, etc. Section OUTSIDE container */}
        <div className="mb-6 mt-10 flex flex-col justify-start">
          <h2 className="theme-text-primary mb-6 mt-0 text-4xl font-extrabold leading-tight md:text-5xl">{book.title}</h2>
          {book.author && <div className="theme-text-secondary mb-2 text-lg">By {book.author}</div>}
          {bookAny.contributors && bookAny.contributors.length > 0 && (
            <div className="theme-text-secondary mb-2">Contributors: {bookAny.contributors.join(', ')}</div>
          )}
          {bookAny.isbn && (
            <div className="theme-text-secondary mb-2">Publisher ID: {bookAny.isbn}</div>
          )}
          {(book.format || bookAny.mediaType || bookAny.acquisitionMediaType || bookAny.publicationTypeLabel) && (
            <div className="mb-2 flex flex-col gap-1">
              <div className="mb-2 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <BookBadges book={book as CatalogBook | BookMetadata} />
                </div>
                {/* Warn if mediaType is missing or is text/html */}
                {!hasSupportedBookFormat && (!normalizedMediaType || normalizedMediaType === 'text/html') && (
                  <div className="theme-text-warning text-xs font-semibold">
                    Warning: This item may not be a valid book file (mediaType is {normalizedMediaType ? 'text/html' : 'missing'}).
                  </div>
                )}
              </div>
            </div>
          )}
          {descriptionText && (
            <div
              className="theme-text-secondary mt-4 text-base leading-7 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          )}
        </div>
        {/* Book Details Section (accessibility, provider) INSIDE container */}
        <div className="md:mb-4 md:mr-6 md:mt-4">
          <h3 className="theme-text-primary mb-3 text-xl font-bold">Book Details</h3>
          <div className="theme-divider mb-5 border-t" />
          <div className="theme-border theme-surface rounded-lg border p-4">
            <div
              className="theme-divider mb-4 flex flex-wrap items-center gap-2 border-b pb-3"
              role="tablist"
              aria-label="Book detail sections"
            >
              {[
                { key: 'bibliographic' as const, label: 'Bibliographic Info' },
                { key: 'accessibility' as const, label: 'Accessibility Info' },
                { key: 'related' as const, label: 'Related Works' },
                { key: 'annotations' as const, label: 'My Bookmarks & Citations' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeDetailTab === tab.key}
                  onClick={() => setActiveDetailTab(tab.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeDetailTab === tab.key
                      ? 'theme-nav-link-active'
                      : 'theme-button-neutral theme-hover-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeDetailTab === 'bibliographic' && (
              <section className="theme-border theme-surface rounded-lg border p-4" aria-label="Book metadata">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="theme-text-primary text-sm font-semibold">Information</h4>
                    <span className="theme-accent-badge inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                      Metadata
                    </span>
                  </div>

                  <DetailField label="Provider">
                    <div className="space-y-1">
                      <div>{bookAny.providerName || (source === 'catalog' ? catalogName : 'Imported locally')}</div>
                      {bookAny.distributor && (
                        <div className="theme-text-muted">Distributor: {bookAny.distributor}</div>
                      )}
                      {bookAny.providerId ? (
                        <div className="theme-text-muted text-xs">
                          Provider ID:{' '}
                          {/^https?:\/\//.test(bookAny.providerId)
                            ? <a href={bookAny.providerId} target="_blank" rel="noopener noreferrer" className="theme-accent-text theme-accent-text-emphasis-hover underline">{bookAny.providerId}</a>
                            : bookAny.providerId}
                        </div>
                      ) : (
                        <div className="theme-text-muted text-xs">Imported locally</div>
                      )}
                    </div>
                  </DetailField>

                  {(publisherText || publicationDateText) && (
                    <DetailField label="Publisher">
                      <div className="space-y-1">
                        {publisherText && <div>{publisherText}</div>}
                        {publicationDateText && <div className="theme-text-muted">Published {publicationDateText}</div>}
                      </div>
                    </DetailField>
                  )}

                  {bookAny.language && (
                    <DetailField label="Language">
                      {bookAny.language}
                    </DetailField>
                  )}

                  {collectionTitles.length > 0 && (
                    <DetailField label="Collections">
                      {collectionTitles.join(', ')}
                    </DetailField>
                  )}

                  {bookAny.categories && bookAny.categories.length > 0 && (
                    <DetailField label="Categories">
                      {bookAny.categories.map((cat: any) => cat.label || cat.term).join(', ')}
                    </DetailField>
                  )}

                  {(!bookAny.categories || bookAny.categories.length === 0) && book.subjects && book.subjects.length > 0 && (
                    <DetailField label="Subjects">
                      {book.subjects.join(', ')}
                    </DetailField>
                  )}
                </div>
              </section>
            )}
            {activeDetailTab === 'accessibility' && (
              <AccessibilityBadges book={book as BookDetailMetadata} />
            )}
            {activeDetailTab === 'related' && (
              hasRelatedWorksSection ? (
                <div className="space-y-4">
                  {relatedFeedLinks.length > 0 && (
                    <section className="theme-border theme-surface rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="theme-text-primary text-sm font-semibold">Browse Related Feeds</h4>
                        <span className="theme-accent-badge inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                          Links
                        </span>
                      </div>
                      <p className="theme-text-primary mb-3 text-xs font-semibold uppercase tracking-[0.14em]">Feeds</p>
                      <div className="flex flex-wrap gap-2">
                        {relatedFeedLinks.map((link) => (
                          <button
                            key={link.url}
                            type="button"
                            onClick={() => onOpenRelatedCatalogFeed?.(link.title, link.url)}
                            className="theme-button-neutral theme-hover-surface inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                          >
                            {link.title}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                  {primarySeries && seriesBooksForLane && (
                    <section className="theme-border theme-surface rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="theme-text-primary text-sm font-semibold">Same Series</h4>
                        <span className="theme-accent-badge inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                          Related
                        </span>
                      </div>
                      <SeriesLane
                        series={primarySeries}
                        books={seriesBooksForLane}
                        onBookClick={(seriesBook) => {
                          if (seriesBook.providerId === ('providerId' in book ? book.providerId : undefined)) {
                            return;
                          }
                          onShowRelatedCatalogBook?.(seriesBook, seriesBooksForLane);
                        }}
                        onViewMore={primarySeries.url
                          ? () => onOpenRelatedCatalogFeed?.(`Same Series: ${primarySeries.name}`, primarySeries.url as string)
                          : undefined}
                      />
                    </section>
                  )}
                </div>
              ) : (
                <section className="theme-border theme-surface rounded-lg border p-4">
                  <p className="theme-text-muted text-sm">No related works available for this title.</p>
                </section>
              )
            )}
            {activeDetailTab === 'annotations' && (
              <BookAnnotationsAside
                className="mt-0"
                libraryBook={libraryBookForAnnotations}
                bookmarks={localBookmarks}
                citations={localCitations}
                userCitationFormat={userCitationFormat}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDetailView;
// BookDetailHeader: handles the header/back button section
const BookDetailHeader: React.FC<{ onBack: () => void, source: 'library' | 'catalog' }> = ({ onBack, source }) => (
  <header className="mb-8">
    <button onClick={onBack} className="theme-text-secondary theme-accent-text-emphasis-hover inline-flex items-center gap-2 transition-colors">
      <LeftArrowIcon className="w-5 h-5" />
      <span>Return to {source === 'library' ? 'My Shelf' : 'Catalog'}</span>
    </button>
  </header>
);
// ...existing code for BookDetailHeader, BookAnnotationsAside, type guards, and utility functions...
