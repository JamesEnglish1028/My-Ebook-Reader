import React, { useEffect, useRef } from 'react';

import type { CatalogBook, CatalogNavigationLink } from '../../../types';
import { ChevronRightIcon, LeftArrowIcon, RightArrowIcon } from '../../icons';
import BookCard from '../shared/BookCard';

interface CatalogSwimLaneProps {
  laneTitle: string;
  laneLink: CatalogNavigationLink;
  books: CatalogBook[];
  isLoading?: boolean;
  error?: string;
  hasFetched?: boolean;
  hasChildNavigation?: boolean;
  onRequestPreview?: (link: CatalogNavigationLink) => void;
  onOpenLane: (link: CatalogNavigationLink) => void;
  onBookClick: (book: CatalogBook) => void;
}

const parseLaneTitleMetadata = (title: string) => {
  const match = title.match(/^(.*?)(?:\s*\((\d+)\))\s*$/);
  if (!match) {
    return {
      displayTitle: title,
      itemCount: null as number | null,
    };
  }

  const displayTitle = match[1]?.trim() || title;
  const itemCount = Number.parseInt(match[2], 10);

  return {
    displayTitle,
    itemCount: Number.isFinite(itemCount) ? itemCount : null,
  };
};

const CatalogSwimLane: React.FC<CatalogSwimLaneProps> = ({
  laneTitle,
  laneLink,
  books,
  isLoading = false,
  error,
  hasFetched = false,
  hasChildNavigation = false,
  onRequestPreview,
  onOpenLane,
  onBookClick,
}) => {
  const laneRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (delta: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };
  const { displayTitle, itemCount } = parseLaneTitleMetadata(laneTitle);
  const primaryStatusLabel = isLoading
    ? 'Loading preview'
    : books.length > 0
      ? `${books.length} preview titles`
      : error
        ? 'Preview unavailable'
        : hasFetched
          ? hasChildNavigation
            ? 'Nested groups inside'
            : 'Open collection'
          : 'Preview loads on scroll';
  const countLabel = itemCount === null ? null : `${itemCount} items`;

  useEffect(() => {
    if (hasFetched || isLoading || !onRequestPreview) return;

    if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
      onRequestPreview(laneLink);
      return;
    }

    const node = laneRef.current;
    if (!node) return;

    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onRequestPreview(laneLink);
        observer.disconnect();
      }
    }, { rootMargin: '240px 0px' });

    observer.observe(node);

    return () => observer.disconnect();
  }, [hasFetched, isLoading, laneLink, onRequestPreview]);

  return (
    <section ref={laneRef} className="theme-surface theme-border mb-6 rounded-2xl border p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onOpenLane(laneLink)}
          className="theme-text-primary min-w-0 text-left transition-colors hover:text-sky-300"
          aria-label={`Open ${displayTitle}`}
        >
          <span className="block truncate text-lg font-semibold sm:text-xl">{displayTitle}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em]">
            {countLabel && <span className="theme-text-muted">{countLabel}</span>}
            {countLabel && <span className="theme-text-muted">•</span>}
            <span className="theme-text-muted">{primaryStatusLabel}</span>
            <span className="theme-accent-text-emphasis inline-flex items-center gap-1 font-medium normal-case tracking-normal">
              Open lane
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByAmount(-320)}
            className="theme-button-neutral theme-hover-surface rounded-full border p-2"
            aria-label={`Scroll ${laneTitle} left`}
          >
            <LeftArrowIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(320)}
            className="theme-button-neutral theme-hover-surface rounded-full border p-2"
            aria-label={`Scroll ${laneTitle} right`}
          >
            <RightArrowIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="theme-surface-muted theme-border theme-text-muted rounded-xl border px-4 py-6 text-sm">
          Could not load preview titles for this lane.
        </div>
      ) : isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2" aria-label={`${laneTitle} loading`}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`${laneTitle}-loading-${index}`}
              className="theme-surface-muted theme-border w-36 flex-shrink-0 rounded-xl border"
            >
              <div className="aspect-[2/3] animate-pulse rounded-t-xl bg-slate-300/20" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 animate-pulse rounded bg-slate-300/20" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-300/20" />
              </div>
            </div>
          ))}
        </div>
      ) : books.length > 0 ? (
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2"
          aria-label={`${laneTitle} titles`}
        >
          {books.map((book, index) => (
            <BookCard
              key={`${laneLink.url}-${book.providerId || book.downloadUrl}-${index}`}
              book={book}
              onClick={(selectedBook) => onBookClick(selectedBook as CatalogBook)}
              className="w-36 flex-shrink-0"
            />
          ))}
        </div>
      ) : !hasFetched ? (
        <div className="theme-surface-muted theme-border theme-text-muted rounded-xl border px-4 py-6 text-sm">
          Preview titles will load when this lane scrolls into view.
        </div>
      ) : (
        <div className="theme-surface-muted theme-border theme-text-muted rounded-xl border px-4 py-6 text-sm">
          {hasChildNavigation
            ? 'This lane opens to nested groups. Open it to browse the next level.'
            : 'No preview titles were available for this lane yet. Open it to browse more.'}
        </div>
      )}
    </section>
  );
};

export default CatalogSwimLane;
