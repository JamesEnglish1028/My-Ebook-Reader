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
  /** Optional right-side action controls */
  actions?: React.ReactNode;
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
  actions,
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
    <div className={(showBreadcrumbs || paginationSummary || showPagination || actions) ? 'mb-5' : undefined}>
      <div className="theme-surface theme-border rounded-xl border px-3 py-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {showBreadcrumbs ? (
            <nav
              aria-label="breadcrumb"
              className="theme-text-secondary flex min-w-0 flex-wrap items-center gap-y-1 text-sm"
            >
              {navPath.map((item, index) => (
                <React.Fragment key={index}>
                  <button
                    onClick={() => onBreadcrumbClick(index)}
                    className={`truncate transition-colors hover:text-sky-300 ${index === navPath.length - 1
                      ? 'theme-text-primary font-medium'
                      : ''
                    }`}
                    aria-current={index === navPath.length - 1 ? 'page' : undefined}
                  >
                    {item.name}
                  </button>
                  {index < navPath.length - 1 && (
                    <ChevronRightIcon className="mx-1 h-4 w-4 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </nav>
          ) : (
            <div />
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {paginationSummary && (
              <p className="theme-text-muted mr-1 text-xs sm:text-sm" aria-live="polite">
                {paginationSummary}
              </p>
            )}

            {showPagination && (
              <div className="theme-surface-muted theme-border flex items-center gap-1 rounded-lg border p-1">
                <button
                  onClick={() => pagination.first && onPaginationClick(pagination.first)}
                  disabled={!pagination.first}
                  className="theme-button-neutral theme-hover-surface rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="First page"
                >
                  First
                </button>
                <button
                  onClick={() => pagination.prev && onPaginationClick(pagination.prev)}
                  disabled={!pagination.prev}
                  className="theme-button-neutral theme-hover-surface inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Previous page"
                >
                  <LeftArrowIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => pagination.next && onPaginationClick(pagination.next)}
                  disabled={!pagination.next}
                  className="theme-button-neutral theme-hover-surface inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Next page"
                >
                  <RightArrowIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => pagination.last && onPaginationClick(pagination.last)}
                  disabled={!pagination.last}
                  className="theme-button-neutral theme-hover-surface rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Last page"
                >
                  Last
                </button>
              </div>
            )}

            {actions}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogNavigation;
