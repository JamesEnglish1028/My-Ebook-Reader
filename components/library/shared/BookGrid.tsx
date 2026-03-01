import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useKeyboardNavigation } from '../../../hooks';
import type { BookMetadata, CatalogBook } from '../../../types';
import Spinner from '../../Spinner';
import BookCard from '../shared/BookCard';

interface BookGridProps {
  /** Books to display */
  books: BookMetadata[] | CatalogBook[];
  /** Whether books are loading */
  isLoading?: boolean;
  /** Callback when book is clicked */
  onBookClick: (book: BookMetadata | CatalogBook) => void;
  /** Callback for context menu (right-click) - optional */
  onBookContextMenu?: (book: BookMetadata | CatalogBook, e: React.MouseEvent) => void;
  /** Additional container class names */
  className?: string;
}

/**
 * BookGrid - Responsive grid layout for displaying books
 *
 * Displays books in a responsive grid with loading state.
 * Uses BookCard component for individual book display.
 */
const BookGrid: React.FC<BookGridProps> = ({
  books,
  isLoading = false,
  onBookClick,
  onBookContextMenu,
  className = '',
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const gridRef = useRef<HTMLDivElement>(null);
  const bookRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Determine number of columns based on viewport width
  const getColumns = useCallback(() => {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width >= 1280) return 6; // xl
    if (width >= 1024) return 5; // lg
    if (width >= 768) return 4;  // md
    if (width >= 640) return 3;  // sm
    return 2; // mobile
  }, []);

  const [columns, setColumns] = useState(getColumns);

  // Update columns on window resize
  useEffect(() => {
    const handleResize = () => setColumns(getColumns());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getColumns]);

  // Handle arrow key navigation
  const handleArrowKey = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (books.length === 0) return;

    setFocusedIndex((currentIndex) => {
      let newIndex = currentIndex;

      // If no item is focused, start at 0
      if (currentIndex === -1) {
        newIndex = 0;
      } else {
        switch (direction) {
          case 'left':
            newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
            break;
          case 'right':
            newIndex = currentIndex < books.length - 1 ? currentIndex + 1 : currentIndex;
            break;
          case 'up':
            newIndex = currentIndex - columns;
            if (newIndex < 0) newIndex = currentIndex; // Stay at current if can't go up
            break;
          case 'down':
            newIndex = currentIndex + columns;
            if (newIndex >= books.length) newIndex = currentIndex; // Stay at current if can't go down
            break;
        }
      }

      // Focus the book card element
      const bookElement = bookRefs.current.get(newIndex);
      if (bookElement) {
        bookElement.focus();
        // Scroll into view if needed
        bookElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      return newIndex;
    });
  }, [books.length, columns]);

  // Handle Enter/Space to activate book
  const handleActivate = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < books.length) {
      onBookClick(books[focusedIndex]);
    }
  }, [focusedIndex, books, onBookClick]);

  // Set up keyboard navigation only when grid is focused
  const [isGridActive, setIsGridActive] = useState(false);

  useKeyboardNavigation({
    enableArrowKeys: isGridActive && books.length > 0,
    enableActivation: isGridActive && books.length > 0,
    onArrowKey: handleArrowKey,
    onActivate: handleActivate,
    preventDefault: true,
  });

  // Handle focus on grid container
  const handleGridFocus = useCallback(() => {
    setIsGridActive(true);
    if (focusedIndex === -1 && books.length > 0) {
      setFocusedIndex(0);
      const firstBook = bookRefs.current.get(0);
      if (firstBook) firstBook.focus();
    }
  }, [focusedIndex, books.length]);

  const handleGridBlur = useCallback((e: React.FocusEvent) => {
    // Only deactivate if focus is leaving the grid entirely
    if (!gridRef.current?.contains(e.relatedTarget as Node)) {
      setIsGridActive(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center mt-20 theme-text-secondary">
        <Spinner />
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 theme-text-primary ${className}`}
      onFocus={handleGridFocus}
      onBlur={handleGridBlur}
      aria-label="Book collection"
    >
      {books.map((book, index) => {
        // Generate a unique key based on book type
        const key = 'id' in book && book.id
          ? `book-${book.id}`
          : `catalog-${('downloadUrl' in book ? book.downloadUrl : book.title)}-${index}`;

        return (
          <BookCard
            key={key}
            book={book}
            onClick={onBookClick}
            onContextMenu={onBookContextMenu}
            isFocused={index === focusedIndex}
            ref={(el: HTMLDivElement | null) => {
              if (el) {
                bookRefs.current.set(index, el);
              } else {
                bookRefs.current.delete(index);
              }
            }}
          />
        );
      })}
    </div>
  );
};

export default BookGrid;
