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
  onBack: () => void;
  onReadBook: (book: BookDetailMetadata) => void;
  onImportFromCatalog?: (book: CatalogBook | BookDetailMetadata, catalogName?: string) => Promise<{ success: boolean; bookRecord?: BookRecord; existingBook?: BookRecord }>;
  importStatus?: ImportStatus | LegacyImportStatus;
  setImportStatus?: ((status: ImportStatus) => void) | React.Dispatch<React.SetStateAction<LegacyImportStatus>>;
  userCitationFormat?: 'apa' | 'mla' | 'chicago' | string;
}

import { LeftArrowIcon } from './icons';
import BookBadges from './library/shared/BookBadges';

const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  (e.target as HTMLImageElement).src = '/default-cover.png';
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

// BookAnnotationsAside component
const BookAnnotationsAside: React.FC<{
  libraryBook: BookMetadata;
  bookmarks: Bookmark[];
  citations: Citation[];
  userCitationFormat: 'apa' | 'mla' | 'chicago' | string;
}> = ({ libraryBook, bookmarks = [], citations = [], userCitationFormat }) => {
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
    <section className="mt-8 space-y-6">
      <div>
        <h3 className="theme-text-primary mb-2 text-lg font-semibold">Bookmarks</h3>
        {bookmarks.length > 0 ? (
          <ul className="space-y-2">
            {bookmarks.map((bm, idx) => (
              <li key={bm.id || idx} className="theme-surface-elevated theme-text-secondary rounded p-3">
                <div className="font-semibold">{bm.label || `Bookmark ${idx + 1}`}</div>
                {bm.description && <div className="theme-text-secondary mt-1 text-sm">{bm.description}</div>}
                {bm.chapter && <div className="theme-text-muted mt-1 text-xs">Chapter: {bm.chapter}</div>}
                <div className="theme-text-muted text-xs">Created: {formatDate(bm.createdAt)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="theme-text-muted text-sm">No bookmarks yet.</div>
        )}
      </div>
      <div>
        <h3 className="theme-text-primary mb-2 flex items-center justify-between text-lg font-semibold">
          Citations
          <button
            className="ml-2 px-3 py-1 rounded bg-sky-700 text-white text-xs font-bold hover:bg-sky-600"
            onClick={() => {
              const ris = citations.map(c => `${c.note || ''} [${c.chapter || ''}${c.pageNumber ? ', p.' + c.pageNumber : ''}]`).join('\n');
              downloadTextFile(`${libraryBook.title || 'citations'}.ris`, ris);
            }}
          >
            Export to RIS
          </button>
        </h3>
        {citations.length > 0 ? (
          <ul className="space-y-2">
            {citations.map((ct, idx) => {
              // Use the citation's formatType (citationFormat) as set by the user in Reader Views
              const rawCitationFormat = ct.citationFormat || userCitationFormat || 'apa';
              const citationFormat = rawCitationFormat === 'mla' ? 'mla' : 'apa';
              const formatted = citationService.formatCitation(libraryBook, ct, citationFormat);
              return (
                <li key={ct.id || idx} className="theme-surface-elevated theme-text-secondary rounded p-3">
                  <div className="font-semibold mb-1">{formatted.text}</div>
                  {ct.note && <div className="theme-text-secondary mt-1 text-sm">{ct.note}</div>}
                  {ct.chapter && <div className="theme-text-muted mt-1 text-xs">Chapter: {ct.chapter}</div>}
                  {ct.pageNumber && <div className="theme-text-muted mt-1 text-xs">Page: {ct.pageNumber}</div>}
                  <div className="theme-text-muted text-xs">Created: {formatDate(ct.createdAt)}</div>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold bg-sky-900 text-sky-300">{formatted.format.toUpperCase()}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="theme-text-muted text-sm">No citations yet.</div>
        )}
      </div>
    </section>
  );
};

interface AnimationData {
  rect: { x: number; y: number; width: number; height: number; top: number; right: number; bottom: number; left: number };
  coverImage?: string;
}


const BookDetailView: React.FC<BookDetailViewProps> = ({ book, onBack, source, catalogName, userCitationFormat = 'apa', onReadBook, onImportFromCatalog, importStatus, setImportStatus }) => {
  const bookAny = book as any;
  const publisherText = typeof bookAny.publisher === 'string' ? bookAny.publisher : bookAny.publisher?.name;
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
  const handleReadClick = () => {
    if (onReadBook && bookAny.id) {
      onReadBook(book);
    }
  };
  // Import button state and modal
  const [showImportSuccess, setShowImportSuccess] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const normalizedFormat = book.format?.toUpperCase() || '';
  const effectiveMediaType = (bookAny.mediaType || bookAny.acquisitionMediaType || '') as string;
  const normalizedMediaType = effectiveMediaType.toLowerCase();
  const hasSupportedBookFormat = normalizedFormat === 'PDF' || normalizedFormat === 'EPUB';
  const hasSupportedBookMediaType =
    normalizedMediaType === 'application/pdf' || normalizedMediaType === 'application/epub+zip';

  // Only allow import if format or mediaType is PDF or EPUB
  const isImportable = (() => {
    return hasSupportedBookFormat || hasSupportedBookMediaType;
  })();

  const handleImportClick = async () => {
    if (isImporting) return;
    setIsImporting(true);
    if (onImportFromCatalog) {
      const result = await onImportFromCatalog(book as CatalogBook, catalogName);
      if (result.success) {
        setShowImportSuccess(true);
      } else if (result.existingBook && setImportStatus) {
        (setImportStatus as React.Dispatch<React.SetStateAction<LegacyImportStatus>>)({
          isLoading: false,
          message: '',
          error: `A book with the same identifier is already in your library: "${result.existingBook.title}".`,
        });
      }
    }
    setIsImporting(false);
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
              className="w-full max-w-xs h-auto object-cover rounded-lg shadow-2xl aspect-[2/3] mb-4"
              onError={handleImgError}
            />
          ) : (
            <div className="theme-surface-elevated theme-text-muted aspect-[2/3] flex w-full max-w-xs items-center justify-center rounded-lg p-4 text-center shadow-2xl">
              <span className="font-semibold">{book.title}</span>
            </div>
          )}
          {source === 'library' ? (
            <button className="mt-2 px-4 py-2 rounded bg-sky-700 text-white font-bold hover:bg-sky-600" onClick={handleReadClick}>
              Read Book
            </button>
          ) : (
            <button
              className="mt-2 px-4 py-2 rounded bg-sky-700 text-white font-bold hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleImportClick}
              disabled={isImporting || !isImportable}
            >
              {isImporting ? 'Importing...' : isImportable ? 'Import to My Library' : 'Cannot Import: Not EPUB or PDF'}
            </button>
          )}
          {showImportSuccess && (
            <div className="fixed inset-0 flex items-center justify-center z-50">
              <div className="theme-surface-elevated theme-border theme-text-primary flex flex-col items-center rounded-lg border p-8 shadow-2xl">
                <h2 className="text-2xl font-bold text-sky-400 mb-4">Import Successful!</h2>
                <p className="theme-text-secondary mb-6">The book has been imported to your library.</p>
                <button className="px-4 py-2 rounded bg-sky-700 text-white font-bold hover:bg-sky-600" onClick={() => setShowImportSuccess(false)}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="w-full max-w-xs mx-auto">
          <BookAnnotationsAside libraryBook={libraryBookForAnnotations} bookmarks={localBookmarks} citations={localCitations} userCitationFormat={userCitationFormat} />
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
        <div className="theme-surface-elevated theme-border space-y-6 rounded-lg border p-6 md:mb-4 md:mr-6 md:mt-4 md:p-8">
          <h3 className="text-xl font-bold text-sky-300 mb-4">Book Details</h3>
          <ul className="space-y-2 text-base">
            <li>
              <span className="theme-text-primary font-semibold">Catalog Provider:</span> <span className="theme-text-secondary">{bookAny.providerName || (source === 'catalog' ? catalogName : 'Imported locally')}</span>
              {bookAny.providerId ? (
                <div className="theme-text-muted mt-1 text-xs">
                  Provider ID: {
                    /^https?:\/\//.test(bookAny.providerId)
                      ? <a href={bookAny.providerId} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-600">{bookAny.providerId}</a>
                      : bookAny.providerId
                  }
                </div>
              ) : (
                <div className="theme-text-muted mt-1 text-xs">Imported locally</div>
              )}
            </li>
            {bookAny.distributor && (
              <li><span className="theme-text-primary font-semibold">Distributor:</span> <span className="theme-text-secondary">{bookAny.distributor}</span></li>
            )}
            {bookAny.accessibilitySummary && <li><span className="theme-text-primary font-semibold">Accessibility:</span> <span className="theme-text-secondary">{bookAny.accessibilitySummary}</span></li>}
            {bookAny.accessibilityFeatures && bookAny.accessibilityFeatures.length > 0 && (
              <li><span className="theme-text-primary font-semibold">Features:</span> <span className="theme-text-secondary">{bookAny.accessibilityFeatures.join(', ')}</span></li>
            )}
            {publisherText && (
              <li><span className="theme-text-primary font-semibold">Publisher:</span> <span className="theme-text-secondary">{publisherText}</span></li>
            )}
            {publicationDateText && (
              <li><span className="theme-text-primary font-semibold">Published:</span> <span className="theme-text-secondary">{publicationDateText}</span></li>
            )}
            {bookAny.language && (
              <li><span className="theme-text-primary font-semibold">Language:</span> <span className="theme-text-secondary">{bookAny.language}</span></li>
            )}
            {bookAny.categories && bookAny.categories.length > 0 && (
              <li>
                <span className="theme-text-primary font-semibold">Categories:</span>{' '}
                <span className="theme-text-secondary">{bookAny.categories.map((cat: any) => cat.label || cat.term).join(', ')}</span>
              </li>
            )}
            {(!bookAny.categories || bookAny.categories.length === 0) && book.subjects && book.subjects.length > 0 && (
              <li>
                <span className="theme-text-primary font-semibold">Subjects:</span>{' '}
                <span className="theme-text-secondary">
                  {book.subjects.map(s => typeof s === 'string' ? s : s.name).join(', ')}
                </span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BookDetailView;
// BookDetailHeader: handles the header/back button section
const BookDetailHeader: React.FC<{ onBack: () => void, source: 'library' | 'catalog' }> = ({ onBack, source }) => (
  <header className="mb-8">
    <button onClick={onBack} className="theme-text-secondary inline-flex items-center gap-2 transition-colors hover:text-sky-400">
      <LeftArrowIcon className="w-5 h-5" />
      <span>Return to {source === 'library' ? 'My Library' : 'Catalog'}</span>
    </button>
  </header>
);
// ...existing code for BookDetailHeader, BookAnnotationsAside, type guards, and utility functions...
