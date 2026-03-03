import React, { useCallback, useState } from 'react';

import { useBooks, useDeleteBook } from '../../../hooks';
import type { BookMetadata, CatalogBook, CoverAnimationData } from '../../../types';
import DeleteConfirmationModal from '../../DeleteConfirmationModal';
import { AdjustmentsVerticalIcon, ListIcon, Squares2X2Icon } from '../../icons';
import { Error as ErrorDisplay, Loading } from '../../shared';
import { BookGrid, EmptyState } from '../shared';

interface LocalLibraryViewProps {
  libraryRefreshFlag: number;
  /** Callback to open a book for reading */
  onOpenBook: (id: number, animationData: CoverAnimationData, format?: string) => void;
  /** Callback to show book detail view */
  onShowBookDetail: (book: BookMetadata, source: 'library' | 'catalog', catalogName?: string, relatedSeriesBooks?: CatalogBook[]) => void;
  /** Callback when file is selected for import */
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Import status */
  importStatus: { isLoading: boolean; message: string; error: string | null };
}

/**
 * LocalLibraryView - Container for local book library
 *
 * Manages fetching, sorting, and displaying books from the local library.
 * Handles delete operations and book clicks.
 */
const LocalLibraryView: React.FC<LocalLibraryViewProps> = ({
  onOpenBook,
  onShowBookDetail,
  onFileChange,
  importStatus,
  libraryRefreshFlag,
}) => {
  console.log('[LocalLibraryView] mounted. libraryRefreshFlag:', libraryRefreshFlag);
  const [bookToDelete, setBookToDelete] = useState<BookMetadata | null>(null);
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [selectedReader, setSelectedReader] = useState<'all' | 'mebooks' | 'palace' | 'thorium'>('all');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'inline'>('grid');
  const [groupByProvider, setGroupByProvider] = useState(false);

  // Fetch books using React Query
  const { data: books = [], isLoading, error, refetch } = useBooks();

  React.useEffect(() => {
    console.log('[LocalLibraryView] useEffect triggered by libraryRefreshFlag:', libraryRefreshFlag);
    refetch();
  }, [libraryRefreshFlag, refetch]);

  const getProviderLabel = React.useCallback((book: BookMetadata) => {
    const providerName = book.providerName?.trim();
    return providerName && providerName.length > 0 ? providerName : 'Local Upload';
  }, []);

  const getFormatValue = React.useCallback((book: BookMetadata) => {
    const normalized = String(book.format || '').trim().toUpperCase();
    return normalized || 'UNKNOWN';
  }, []);

  const getFormatLabel = React.useCallback((formatValue: string) => {
    if (formatValue === 'EPUB' || formatValue === 'PDF') return formatValue;
    if (formatValue === 'AUDIOBOOK') return 'Audiobook';
    if (formatValue === 'UNKNOWN') return 'Unknown';
    return formatValue;
  }, []);

  const getReaderDestination = React.useCallback((book: BookMetadata): 'mebooks' | 'palace' | 'thorium' => {
    if (book.externalReaderApp === 'palace') return 'palace';
    if (book.externalReaderApp === 'thorium') return 'thorium';
    return 'mebooks';
  }, []);

  const getReaderLabel = React.useCallback((reader: 'mebooks' | 'palace' | 'thorium') => {
    if (reader === 'palace') return 'Read in Palace';
    if (reader === 'thorium') return 'Read in Thorium';
    return 'Read Here';
  }, []);

  const formatOptions = React.useMemo(() => (
    Array.from(new Set(books.map((book) => getFormatValue(book)))).sort()
  ), [books, getFormatValue]);

  const providerOptions = React.useMemo(() => (
    Array.from(new Set(books.map((book) => getProviderLabel(book)))).sort((a, b) => a.localeCompare(b))
  ), [books, getProviderLabel]);
  const readerOptions = React.useMemo(() => (
    Array.from(new Set(books.map((book) => getReaderDestination(book))))
  ), [books, getReaderDestination]);
  const showFormatFilter = formatOptions.length > 1;
  const showProviderFilter = providerOptions.length > 1;
  const showReaderFilter = readerOptions.length > 1;
  const hasFilterControl = showFormatFilter || showProviderFilter || showReaderFilter;
  const activeFilterCount = Number(selectedFormat !== 'all') + Number(selectedProvider !== 'all') + Number(selectedReader !== 'all');

  React.useEffect(() => {
    if (selectedFormat !== 'all' && !formatOptions.includes(selectedFormat)) {
      setSelectedFormat('all');
    }
  }, [formatOptions, selectedFormat]);

  React.useEffect(() => {
    if (selectedProvider !== 'all' && !providerOptions.includes(selectedProvider)) {
      setSelectedProvider('all');
    }
  }, [providerOptions, selectedProvider]);

  React.useEffect(() => {
    if (selectedReader !== 'all' && !readerOptions.includes(selectedReader)) {
      setSelectedReader('all');
    }
  }, [readerOptions, selectedReader]);

  const filteredBooks = React.useMemo(() => (
    books.filter((book) => {
      if (selectedFormat !== 'all' && getFormatValue(book) !== selectedFormat) {
        return false;
      }
      if (selectedProvider !== 'all' && getProviderLabel(book) !== selectedProvider) {
        return false;
      }
      if (selectedReader !== 'all' && getReaderDestination(book) !== selectedReader) {
        return false;
      }
      return true;
    })
  ), [books, getFormatValue, getProviderLabel, getReaderDestination, selectedFormat, selectedProvider, selectedReader]);

  const groupedByReader = React.useMemo(() => {
    const buckets: Record<'mebooks' | 'palace' | 'thorium', BookMetadata[]> = {
      mebooks: [],
      palace: [],
      thorium: [],
    };

    filteredBooks.forEach((book) => {
      buckets[getReaderDestination(book)].push(book);
    });

    const order: Array<'mebooks' | 'palace' | 'thorium'> = ['mebooks', 'palace', 'thorium'];
    return order
      .filter((reader) => buckets[reader].length > 0)
      .map((reader) => ({
        key: reader,
        title: getReaderLabel(reader),
        books: buckets[reader].slice().sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [filteredBooks, getReaderDestination, getReaderLabel]);

  // Delete book mutation
  const { mutate: deleteBook } = useDeleteBook();

  // Handle book click - open Book Detail modal
  const handleLocalBookClick = (book: BookMetadata) => {
    onShowBookDetail(book, 'library');
  };

  // Handle context menu - show delete option
  const handleBookContextMenu = (book: BookMetadata, e: React.MouseEvent) => {
    e.preventDefault();
    setBookToDelete(book);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(() => {
    if (!bookToDelete?.id) return;

    deleteBook(bookToDelete.id, {
      onSuccess: () => {
        setBookToDelete(null);
      },
    });
  }, [bookToDelete, deleteBook]);

  const renderInlineBookRow = (book: BookMetadata) => {
    const providerLabel = getProviderLabel(book);
    const formatLabel = getFormatLabel(getFormatValue(book));
    const readerDestination = getReaderDestination(book);
    const formatTone = formatLabel === 'PDF'
      ? 'bg-red-600 text-white'
      : formatLabel === 'Audiobook'
        ? 'bg-purple-600 text-white'
        : 'bg-sky-500 text-white';

    return (
      <button
        key={book.id}
        type="button"
        onClick={() => handleLocalBookClick(book)}
        onContextMenu={(event) => handleBookContextMenu(book, event)}
        className="theme-surface-elevated theme-border theme-hover-surface flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-colors"
      >
        <div className="theme-surface-muted flex h-16 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md">
          {book.coverImage ? (
            <img
              src={book.coverImage}
              alt={book.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="theme-text-muted px-1 text-center text-[10px] font-semibold">
              {formatLabel}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="theme-text-primary truncate text-sm font-semibold">{book.title}</div>
          <div className="theme-text-secondary truncate text-xs">{book.author}</div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${formatTone}`}>
            {formatLabel}
          </span>
          <span className="theme-info inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {providerLabel}
          </span>
          {readerDestination !== 'mebooks' && (
            <span className="theme-accent-badge inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {readerDestination === 'palace' ? 'Palace' : 'Thorium'}
            </span>
          )}
        </div>
      </button>
    );
  };

  const renderInlineList = (booksToRender: BookMetadata[]) => {
    if (groupByProvider) {
      const groupedBooks = new Map<string, BookMetadata[]>();
      booksToRender.forEach((book) => {
        const key = getProviderLabel(book);
        const existing = groupedBooks.get(key);
        if (existing) {
          existing.push(book);
        } else {
          groupedBooks.set(key, [book]);
        }
      });

      const providerGroups = Array.from(groupedBooks.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([provider, providerBooks]) => ({
          provider,
          books: [...providerBooks].sort((a, b) => a.title.localeCompare(b.title)),
        }));

      return (
        <div className="space-y-5">
          {providerGroups.map((group) => (
            <section key={group.provider} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="theme-text-primary text-sm font-semibold">{group.provider}</h3>
                <span className="theme-text-muted text-xs">{group.books.length} title{group.books.length === 1 ? '' : 's'}</span>
              </div>
              <div className="space-y-2">
                {group.books.map(renderInlineBookRow)}
              </div>
            </section>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {booksToRender.map(renderInlineBookRow)}
      </div>
    );
  };

  // Show loading state
  if (isLoading) {
    return <Loading variant="skeleton" message="Loading library..." />;
  }

  // Show error state
  if (error) {
    return (
      <ErrorDisplay
        variant="page"
        title="Failed to Load Library"
        message={error instanceof Error ? error.message : 'Could not load books from the library.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <>
      {books.length > 0 ? (
        <>
          {hasFilterControl && (
            <section className="mb-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="theme-text-muted text-sm">
                  Showing {filteredBooks.length} of {books.length} books
                </div>
                <div className="flex items-center gap-2">
                  <div className="theme-button-neutral inline-flex rounded-lg border p-1">
                    <button
                      type="button"
                      onClick={() => setLayoutMode('grid')}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        layoutMode === 'grid' ? 'theme-nav-link-active' : 'theme-text-secondary'
                      }`}
                      aria-label="Grid layout"
                      title="Grid layout"
                    >
                      <Squares2X2Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutMode('inline')}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        layoutMode === 'inline' ? 'theme-nav-link-active' : 'theme-text-secondary'
                      }`}
                      aria-label="Inline layout"
                      title="Inline layout"
                    >
                      <ListIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Inline</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFiltersOpen((prev) => !prev)}
                    className={`theme-button-neutral theme-hover-surface inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      isFiltersOpen ? 'theme-nav-link-active' : ''
                    }`}
                    aria-label={isFiltersOpen ? 'Hide filters' : 'Open filters'}
                    title={activeFilterCount > 0 ? `${activeFilterCount} active filters` : 'Filters'}
                  >
                    <AdjustmentsVerticalIcon className="h-4 w-4" />
                    <span>{activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}</span>
                  </button>
                </div>
              </div>

              {isFiltersOpen && (
                <div className="theme-surface theme-border rounded-xl border p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="theme-text-secondary text-xs font-semibold uppercase tracking-[0.18em]">Filters</h3>
                    <span className="theme-text-muted text-[11px]">
                      {activeFilterCount > 0 ? `${activeFilterCount} active` : 'Local only'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-start gap-3">
                    {showFormatFilter && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="theme-text-muted text-xs font-medium uppercase tracking-[0.12em]">Format</span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedFormat('all')}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                              selectedFormat === 'all' ? 'theme-nav-link-active border' : 'theme-pill theme-hover-surface'
                            }`}
                          >
                            All
                          </button>
                          {formatOptions.map((formatValue) => (
                            <button
                              key={formatValue}
                              type="button"
                              onClick={() => setSelectedFormat(formatValue)}
                              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                selectedFormat === formatValue ? 'theme-nav-link-active border' : 'theme-pill theme-hover-surface'
                              }`}
                            >
                              {getFormatLabel(formatValue)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showProviderFilter && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="theme-text-muted text-xs font-medium uppercase tracking-[0.12em]">Provider</span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedProvider('all')}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                              selectedProvider === 'all' ? 'theme-nav-link-active border' : 'theme-pill theme-hover-surface'
                            }`}
                          >
                            All
                          </button>
                          {providerOptions.map((provider) => (
                            <button
                              key={provider}
                              type="button"
                              onClick={() => setSelectedProvider(provider)}
                              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                selectedProvider === provider ? 'theme-nav-link-active border' : 'theme-pill theme-hover-surface'
                              }`}
                            >
                              {provider}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showReaderFilter && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="theme-text-muted text-xs font-medium uppercase tracking-[0.12em]">Reading App</span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedReader('all')}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                              selectedReader === 'all' ? 'theme-nav-link-active border' : 'theme-pill theme-hover-surface'
                            }`}
                          >
                            All
                          </button>
                          {readerOptions.map((reader) => (
                            <button
                              key={reader}
                              type="button"
                              onClick={() => setSelectedReader(reader)}
                              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                selectedReader === reader ? 'theme-nav-link-active border' : 'theme-pill theme-hover-surface'
                              }`}
                            >
                              {getReaderLabel(reader)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="theme-text-muted text-xs font-medium uppercase tracking-[0.12em]">Grouping</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setGroupByProvider(false)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            !groupByProvider ? 'theme-nav-link-active border' : 'theme-pill theme-hover-surface'
                          }`}
                        >
                          None
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLayoutMode('inline');
                            setGroupByProvider(true);
                          }}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            groupByProvider ? 'theme-nav-link-active border' : 'theme-pill theme-hover-surface'
                          }`}
                        >
                          Provider
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {filteredBooks.length > 0 ? (
            <div className="space-y-6">
              {groupedByReader.map((group) => (
                <section key={group.key} className="space-y-3">
                  {groupedByReader.length > 1 && (
                    <div className="flex items-center justify-between">
                      <h3 className="theme-text-primary text-sm font-semibold uppercase tracking-[0.12em]">{group.title}</h3>
                      <span className="theme-text-muted text-xs">{group.books.length} title{group.books.length === 1 ? '' : 's'}</span>
                    </div>
                  )}
                  {layoutMode === 'grid' ? (
                    <BookGrid
                      books={group.books}
                      onBookClick={handleLocalBookClick}
                      onBookContextMenu={handleBookContextMenu}
                    />
                  ) : (
                    renderInlineList(group.books)
                  )}
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              variant="library"
              title="No matching books"
              message="Adjust the My Shelf filters to see more books."
            />
          )}
        </>
      ) : (
        <EmptyState variant="library" />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!bookToDelete}
        onClose={() => setBookToDelete(null)}
        onConfirm={handleDeleteConfirm}
        bookTitle={bookToDelete?.title || ''}
      />
    </>
  );
};

export default LocalLibraryView;
