import React from 'react';

import type { CatalogBook, SeriesInfo } from '../../../types';

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

        {/* Compact horizontal list */}
        <div className="flex gap-3 overflow-x-auto pb-2 pr-1">
          {sortedBooks.map((book) => {
            const seriesInfo = book.series?.find(s => s.name === series.name);
            const position = seriesInfo?.position;

            return (
              <button
                key={`${book.providerId || book.title}-${position ?? 'na'}`}
                type="button"
                onClick={() => onBookClick(book)}
                className="theme-surface-elevated theme-border theme-hover-surface flex min-w-[220px] flex-shrink-0 items-center gap-3 rounded-xl border p-2.5 text-left transition-colors"
              >
                <div className="theme-surface-muted flex h-16 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-md">
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="theme-text-muted px-1 text-center text-[10px] font-semibold">
                      {book.format || 'Book'}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="theme-text-primary truncate text-sm font-semibold">{book.title}</p>
                      <p className="theme-text-secondary truncate text-xs">{book.author}</p>
                    </div>
                    {position !== undefined && (
                      <span className="theme-accent-badge inline-flex h-6 min-w-6 flex-shrink-0 items-center justify-center rounded-full border px-1.5 text-[10px] font-bold">
                        {position}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {book.format && (
                      <span className="theme-surface-muted theme-text-secondary inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        {book.format}
                      </span>
                    )}
                    {seriesInfo?.volume && (
                      <span className="theme-info inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        Vol. {seriesInfo.volume}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SeriesLane;
