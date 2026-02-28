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
        <h3 className="text-lg font-semibold text-slate-200 mb-2">Bookmarks</h3>
        {bookmarks.length > 0 ? (
          <ul className="space-y-2">
            {bookmarks.map((bm, idx) => (
              <li key={bm.id || idx} className="bg-slate-800 rounded p-3 text-slate-300">
                <div className="font-semibold">{bm.label || `Bookmark ${idx + 1}`}</div>
                {bm.description && <div className="text-slate-400 text-sm mt-1">{bm.description}</div>}
                {bm.chapter && <div className="text-xs text-slate-500 mt-1">Chapter: {bm.chapter}</div>}
                <div className="text-xs text-slate-500">Created: {formatDate(bm.createdAt)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-slate-500 text-sm">No bookmarks yet.</div>
        )}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-200 mb-2 flex items-center justify-between">
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
                <li key={ct.id || idx} className="bg-slate-800 rounded p-3 text-slate-300">
                  <div className="font-semibold mb-1">{formatted.text}</div>
                  {ct.note && <div className="text-slate-400 text-sm mt-1">{ct.note}</div>}
                  {ct.chapter && <div className="text-xs text-slate-500 mt-1">Chapter: {ct.chapter}</div>}
                  {ct.pageNumber && <div className="text-xs text-slate-500 mt-1">Page: {ct.pageNumber}</div>}
                  <div className="text-xs text-slate-500">Created: {formatDate(ct.createdAt)}</div>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold bg-sky-900 text-sky-300">{formatted.format.toUpperCase()}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-slate-500 text-sm">No citations yet.</div>
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
  const effectiveMediaType = (bookAny.mediaType || bookAny.acquisitionMediaType || '') as string;
  const normalizedMediaType = effectiveMediaType.toLowerCase();

  // Only allow import if format or mediaType is PDF or EPUB
  const isImportable = (() => {
    const format = book.format?.toUpperCase();
    return (
      format === 'PDF' || format === 'EPUB' ||
      normalizedMediaType === 'application/pdf' || normalizedMediaType === 'application/epub+zip'
    );
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
    <div className="flex flex-col md:flex-row gap-8 items-start px-4 md:px-12 md:pr-16">
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
            <div className="w-full max-w-xs flex items-center justify-center p-4 text-center text-slate-400 bg-slate-800 rounded-lg aspect-[2/3] shadow-2xl">
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
              <div className="bg-slate-900 bg-opacity-90 p-8 rounded-lg shadow-2xl flex flex-col items-center">
                <h2 className="text-2xl font-bold text-sky-400 mb-4">Import Successful!</h2>
                <p className="text-slate-200 mb-6">The book has been imported to your library.</p>
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
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-100 mb-6 leading-tight mt-0">{book.title}</h2>
          {book.author && <div className="mb-2 text-lg text-slate-400">By {book.author}</div>}
          {bookAny.contributors && bookAny.contributors.length > 0 && (
            <div className="mb-2 text-slate-400">Contributors: {bookAny.contributors.join(', ')}</div>
          )}
          {publisherText && <div className="mb-2 text-slate-400">Publisher: {publisherText}</div>}
          {bookAny.publicationDate && <div className="mb-2 text-slate-400">Published: {bookAny.publicationDate}</div>}
          {bookAny.isbn && (
            <div className="mb-2 text-slate-400">Publisher ID: {bookAny.isbn}</div>
          )}
          {bookAny.language && <div className="mb-2 text-slate-400">Language: {bookAny.language}</div>}
          {(book.format || bookAny.mediaType || bookAny.acquisitionMediaType || bookAny.publicationTypeLabel) && (
            <div className="mb-2 flex flex-col gap-1">
              <div className="mb-2 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <BookBadges book={book as CatalogBook | BookMetadata} />
                </div>
                {/* Warn if mediaType is missing or is text/html */}
                {(!normalizedMediaType || normalizedMediaType === 'text/html') && (
                  <div className="text-xs text-yellow-400 font-semibold">
                    Warning: This item may not be a valid book file (mediaType is {normalizedMediaType ? 'text/html' : 'missing'}).
                  </div>
                )}
              </div>
            </div>
          )}
          {(bookAny.description || bookAny.summary) && <div className="mt-4 text-slate-300 text-base">{bookAny.description || bookAny.summary}</div>}
        </div>
        {/* Book Details Section (accessibility, provider) INSIDE container */}
        <div className="space-y-6 p-6 bg-slate-800 rounded-lg border border-slate-700 md:mt-4 md:mr-6 md:mb-4 md:p-8">
          <h3 className="text-xl font-bold text-sky-300 mb-4">Book Details</h3>
          <ul className="space-y-2 text-base">
            <li>
              <span className="font-semibold text-slate-200">Provider:</span> <span className="text-slate-400">{bookAny.providerName || (source === 'catalog' ? catalogName : 'Imported locally')}</span>
              {bookAny.providerId ? (
                <div className="text-xs text-slate-500 mt-1">
                  Provider ID: {
                    /^https?:\/\//.test(bookAny.providerId)
                      ? <a href={bookAny.providerId} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-600">{bookAny.providerId}</a>
                      : bookAny.providerId
                  }
                </div>
              ) : (
                <div className="text-xs text-slate-500 mt-1">Imported locally</div>
              )}
            </li>
            {bookAny.accessibilitySummary && <li><span className="font-semibold text-slate-200">Accessibility:</span> <span className="text-slate-400">{bookAny.accessibilitySummary}</span></li>}
            {bookAny.accessibilityFeatures && bookAny.accessibilityFeatures.length > 0 && (
              <li><span className="font-semibold text-slate-200">Features:</span> <span className="text-slate-400">{bookAny.accessibilityFeatures.join(', ')}</span></li>
            )}
            {bookAny.categories && bookAny.categories.length > 0 && (
              <li>
                <span className="font-semibold text-slate-200">Categories:</span>{' '}
                <span className="text-slate-400">{bookAny.categories.map((cat: any) => cat.label || cat.term).join(', ')}</span>
              </li>
            )}
            {(!bookAny.categories || bookAny.categories.length === 0) && book.subjects && book.subjects.length > 0 && (
              <li>
                <span className="font-semibold text-slate-200">Subjects:</span>{' '}
                <span className="text-slate-400">
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
    <button onClick={onBack} className="inline-flex items-center gap-2 text-slate-300 hover:text-sky-400 transition-colors">
      <LeftArrowIcon className="w-5 h-5" />
      <span>Return to {source === 'library' ? 'My Library' : 'Catalog'}</span>
    </button>
  </header>
);
// ...existing code for BookDetailHeader, BookAnnotationsAside, type guards, and utility functions...
