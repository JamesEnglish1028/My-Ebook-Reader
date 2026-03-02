import React, { useCallback, useState } from 'react';

import { useBooks, useDeleteBook } from '../../../hooks';
import type { BookMetadata, CoverAnimationData } from '../../../types';
import DeleteConfirmationModal from '../../DeleteConfirmationModal';
import { AdjustmentsVerticalIcon } from '../../icons';
import { Error as ErrorDisplay, Loading } from '../../shared';
import { BookGrid, EmptyState } from '../shared';

interface LocalLibraryViewProps {
  libraryRefreshFlag: number;
  /** Callback to open a book for reading */
  onOpenBook: (id: number, animationData: CoverAnimationData, format?: string) => void;
  /** Callback to show book detail view */
  onShowBookDetail: (book: BookMetadata, source: 'library' | 'catalog') => void;
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
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

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

  const formatOptions = React.useMemo(() => (
    Array.from(new Set(books.map((book) => getFormatValue(book)))).sort()
  ), [books, getFormatValue]);

  const providerOptions = React.useMemo(() => (
    Array.from(new Set(books.map((book) => getProviderLabel(book)))).sort((a, b) => a.localeCompare(b))
  ), [books, getProviderLabel]);
  const showFormatFilter = formatOptions.length > 1;
  const showProviderFilter = providerOptions.length > 1;
  const hasFilterControl = showFormatFilter || showProviderFilter;
  const activeFilterCount = Number(selectedFormat !== 'all') + Number(selectedProvider !== 'all');

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

  const filteredBooks = React.useMemo(() => (
    books.filter((book) => {
      if (selectedFormat !== 'all' && getFormatValue(book) !== selectedFormat) {
        return false;
      }
      if (selectedProvider !== 'all' && getProviderLabel(book) !== selectedProvider) {
        return false;
      }
      return true;
    })
  ), [books, getFormatValue, getProviderLabel, selectedFormat, selectedProvider]);

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
                  </div>
                </div>
              )}
            </section>
          )}

          {filteredBooks.length > 0 ? (
            <BookGrid
              books={filteredBooks}
              onBookClick={handleLocalBookClick}
              onBookContextMenu={handleBookContextMenu}
            />
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
