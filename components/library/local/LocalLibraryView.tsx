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

  // Fetch books using React Query
  const { data: books = [], isLoading, error, refetch } = useBooks();

  React.useEffect(() => {
    console.log('[LocalLibraryView] useEffect triggered by libraryRefreshFlag:', libraryRefreshFlag);
    refetch();
  }, [libraryRefreshFlag, refetch]);

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
        <BookGrid
          books={books}
          onBookClick={handleLocalBookClick}
          onBookContextMenu={handleBookContextMenu}
        />
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
