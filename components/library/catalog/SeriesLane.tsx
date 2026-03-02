import React from 'react';

import type { CatalogBook, SeriesInfo } from '../../../types';
import BookCard from '../shared/BookCard';

interface SeriesLaneProps {
  series: SeriesInfo;
  books: CatalogBook[];
  onBookClick: (book: CatalogBook) => void;
  className?: string;
}

/**
 * SeriesLane Component
 *
 * Displays books grouped by series, with position information.
 * Allows users to explore books within a series.
 */
const SeriesLane: React.FC<SeriesLaneProps> = ({
  series,
  books,
  onBookClick,
  className = '',
}) => {
  if (!books || books.length === 0) {
    return null;
  }

  // Sort books by series position
  const sortedBooks = [...books].sort((a, b) => {
    const posA = a.series?.find(s => s.name === series.name)?.position ?? Number.MAX_VALUE;
    const posB = b.series?.find(s => s.name === series.name)?.position ?? Number.MAX_VALUE;
    return (posA as number) - (posB as number);
  });

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-3">
        {/* Series Header */}
        <div className="flex items-baseline justify-between">
          <h2 className="theme-text-primary text-lg font-bold">
            Series: {series.name}
          </h2>
          <p className="theme-text-muted text-xs">
            {books.length} book{books.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Series Description */}
        {series.url && (
          <a
            href={series.url}
            className="theme-accent-text theme-accent-text-emphasis-hover text-xs underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View series →
          </a>
        )}

        {/* Books Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {sortedBooks.map((book) => {
            const seriesInfo = book.series?.find(s => s.name === series.name);
            const position = seriesInfo?.position;

            return (
              <div key={`${book.providerId || book.title}-${position ?? 'na'}`} className="relative">
                {/* Book Card */}
                <BookCard
                  book={book}
                  onClick={onBookClick}
                  className="h-full"
                />

                {/* Series Position Badge */}
                {position !== undefined && (
                  <div className="theme-accent-badge absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold shadow-lg">
                    {position}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SeriesLane;
