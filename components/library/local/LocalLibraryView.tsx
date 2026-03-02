import React, { useCallback, useState } from 'react';

import { useBooks, useDeleteBook } from '../../../hooks';
import type { BookMetadata, CoverAnimationData } from '../../../types';
import DeleteConfirmationModal from '../../DeleteConfirmationModal';
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
          <section className="theme-surface theme-border mb-5 rounded-xl border p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
                <span className="theme-text-secondary font-medium">Format</span>
                <select
                  className="theme-input rounded-md border px-3 py-2"
                  value={selectedFormat}
                  onChange={(event) => setSelectedFormat(event.target.value)}
                >
                  <option value="all">All Formats</option>
                  {formatOptions.map((formatValue) => (
                    <option key={formatValue} value={formatValue}>
                      {getFormatLabel(formatValue)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[14rem] flex-col gap-1 text-sm">
                <span className="theme-text-secondary font-medium">Provider</span>
                <select
                  className="theme-input rounded-md border px-3 py-2"
                  value={selectedProvider}
                  onChange={(event) => setSelectedProvider(event.target.value)}
                >
                  <option value="all">All Providers</option>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </label>
              <div className="theme-text-muted text-sm md:ml-auto">
                Showing {filteredBooks.length} of {books.length} books
              </div>
            </div>
          </section>

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
