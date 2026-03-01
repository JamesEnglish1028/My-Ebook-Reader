import React from 'react';

import type { CatalogPagination } from '../../../types';
import { ChevronRightIcon, LeftArrowIcon, RightArrowIcon } from '../../icons';

interface CatalogNavigationProps {
  /** Breadcrumb navigation path */
  navPath: { name: string; url: string }[];
  /** Pagination links */
  pagination: CatalogPagination | null;
  /** Callback for breadcrumb navigation */
  onBreadcrumbClick: (index: number) => void;
  /** Callback for pagination (prev/next) */
  onPaginationClick: (url: string) => void;
  /** Whether catalog is currently loading */
  isLoading?: boolean;
}

/**
 * CatalogNavigation - Displays breadcrumb trail and pagination controls
 *
 * Shows the navigation path through catalog sections and provides
 * First/Previous/Next/Last buttons for paginated results.
 */
const CatalogNavigation: React.FC<CatalogNavigationProps> = ({
  navPath,
  pagination,
  onBreadcrumbClick,
  onPaginationClick,
  isLoading = false,
}) => {
  const showBreadcrumbs = navPath.length > 0;
  const showPagination = pagination && (pagination.first || pagination.prev || pagination.next || pagination.last) && !isLoading;
  const paginationSummary = React.useMemo(() => {
    if (!pagination || isLoading) return null;

    const totalResults = Number.isFinite(pagination.totalResults) ? Number(pagination.totalResults) : undefined;
    const itemsPerPage = Number.isFinite(pagination.itemsPerPage) ? Number(pagination.itemsPerPage) : undefined;
    const startIndex = Number.isFinite(pagination.startIndex) ? Math.max(1, Number(pagination.startIndex)) : undefined;

    if (totalResults !== undefined && startIndex !== undefined && itemsPerPage !== undefined) {
      const rangeEnd = Math.min(startIndex + itemsPerPage - 1, totalResults);
      return `Showing ${startIndex}-${rangeEnd} of ${totalResults}`;
    }

    if (startIndex !== undefined && itemsPerPage !== undefined) {
      return `Showing ${startIndex}-${startIndex + itemsPerPage - 1}`;
    }

    if (totalResults !== undefined) {
      return `${totalResults} results`;
    }

    return null;
  }, [isLoading, pagination]);

  return (
    <>
      {showBreadcrumbs && (
        <nav
          aria-label="breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-y-1 rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2 text-sm text-slate-400 theme-surface theme-border theme-text-secondary"
        >
          {navPath.map((item, index) => (
            <React.Fragment key={index}>
              <button
                onClick={() => onBreadcrumbClick(index)}
                className={`truncate transition-colors hover:text-sky-300 ${index === navPath.length - 1
                  ? 'font-medium text-white theme-text-primary'
                  : ''
                }`}
                aria-current={index === navPath.length - 1 ? 'page' : undefined}
              >
                {item.name}
              </button>
              {index < navPath.length - 1 && (
                <ChevronRightIcon className="w-4 h-4 mx-1 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {(paginationSummary || showPagination) && (
        <div className="mt-6 space-y-3">
          {paginationSummary && (
            <p className="text-sm text-slate-400 theme-text-secondary" aria-live="polite">
              {paginationSummary}
            </p>
          )}

          {showPagination && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => pagination.first && onPaginationClick(pagination.first)}
                  disabled={!pagination.first}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition-colors duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 theme-button-neutral theme-hover-surface"
                  aria-label="First page"
                >
                  <span>First</span>
                </button>
                <button
                  onClick={() => pagination.prev && onPaginationClick(pagination.prev)}
                  disabled={!pagination.prev}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition-colors duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 theme-button-neutral theme-hover-surface"
                  aria-label="Previous page"
                >
                  <LeftArrowIcon className="h-4 w-4" />
                  <span>Previous</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => pagination.next && onPaginationClick(pagination.next)}
                  disabled={!pagination.next}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition-colors duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 theme-button-neutral theme-hover-surface"
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <RightArrowIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => pagination.last && onPaginationClick(pagination.last)}
                  disabled={!pagination.last}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition-colors duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 theme-button-neutral theme-hover-surface"
                  aria-label="Last page"
                >
                  <span>Last</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default CatalogNavigation;
