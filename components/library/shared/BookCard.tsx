import React from 'react';

import { proxiedUrl } from '../../../services/utils';
import type { BookMetadata, CatalogBook } from '../../../types';

import BookBadges from './BookBadges';

interface BookCardProps {
  book: BookMetadata | CatalogBook;
  onClick: (book: BookMetadata | CatalogBook) => void;
  onContextMenu?: (book: BookMetadata | CatalogBook, e: React.MouseEvent) => void;
  className?: string;
  isFocused?: boolean;
}

/**
 * BookCard - Reusable card component for displaying books
 *
 * Displays book cover, title, author, and format badges.
 * Works with both local library books (BookMetadata) and catalog books (CatalogBook).
 */
const BookCard = React.forwardRef<HTMLDivElement, BookCardProps>(({
  book,
  onClick,
  onContextMenu,
  className = '',
  isFocused = false,
}, ref) => {
  const handleClick = () => onClick(book);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(book, e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(book);
    }
  };

  // Type guard to check if book is from catalog
  const isCatalogBook = (b: BookMetadata | CatalogBook): b is CatalogBook => {
    return 'downloadUrl' in b;
  };

  // Get cover image URL
  const getCoverImage = (): string | null => {
    if ('coverImage' in book && book.coverImage) {
      return book.coverImage as string;
    }
    if ('cover' in book && book.cover) {
      return book.cover as string;
    }
    return null;
  };

  const coverImage = getCoverImage();

  const contributors = isCatalogBook(book) ? book.contributors ?? [] : [];
  const categories = isCatalogBook(book)
    ? (book.categories ?? []).map((cat) => cat.label || cat.term).filter(Boolean)
    : [];

  return (
    <div
      ref={ref}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`${book.title} by ${book.author}`}
      className={`cursor-pointer group relative focus:outline-none ${isFocused ? 'ring-2 ring-sky-500 ring-offset-2 theme-ring-offset' : ''} ${className}`}
    >
      {/* Book Cover */}
      <div className="theme-surface-elevated book-cover-container aspect-[2/3] overflow-hidden rounded-lg shadow-lg transform transition-transform duration-300 group-hover:scale-105">
        {coverImage ? (
          <img
            src={coverImage}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.onerror = null as any;
              // Try proxied URL for catalog books
              if (isCatalogBook(book) && book.coverImage) {
                img.src = proxiedUrl(book.coverImage);
              }
            }}
          />
        ) : (
          <div className="theme-text-muted flex h-full w-full items-center justify-center p-4 text-center">
            <span className="font-semibold">{book.title}</span>
          </div>
        )}
      </div>

      {/* Book Info */}
      <div className="mt-2 space-y-1">
        <h3 className="theme-text-primary truncate text-sm font-semibold group-hover:text-sky-400">
          {book.title}
        </h3>
        <p className="theme-text-secondary truncate text-xs">
          {book.author}
        </p>
        {contributors.length > 0 && (
          <p className="theme-text-secondary truncate text-[11px]" title={contributors.join(', ')}>
            Contributors: {contributors.slice(0, 2).join(', ')}
          </p>
        )}
        {categories.length > 0 && (
          <p className="theme-text-muted truncate text-[11px]" title={categories.join(', ')}>
            Categories: {categories.slice(0, 2).join(', ')}
          </p>
        )}
        <BookBadges book={book} />
      </div>
    </div>
  );
});

BookCard.displayName = 'BookCard';

export default BookCard;
