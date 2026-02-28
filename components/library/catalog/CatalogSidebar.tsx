import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useFocusTrap } from '../../../hooks';
import { proxiedUrl } from '../../../services/utils';
import type { CatalogFacetGroup, CatalogFacetLink, CatalogNavigationLink } from '../../../types';
import { CloseIcon } from '../../icons';

interface CatalogSidebarProps {
  /** Parsed catalog navigation links */
  navigationLinks: CatalogNavigationLink[];
  /** Current feed URL for active navigation styling */
  currentNavigationUrl?: string | null;
  /** Parsed facet groups for the current feed */
  facetGroups: CatalogFacetGroup[];
  /** Callback when a navigation link is selected */
  onNavigationSelect: (link: CatalogNavigationLink) => void;
  /** Callback when a facet link is selected */
  onFacetSelect: (link: CatalogFacetLink) => void;
  /** Whether catalog is currently loading */
  isLoading?: boolean;
}

/**
 * CatalogSidebar - Spec-aligned OPDS sidebar
 *
 * Renders parsed navigation links and facet groups separately so the UI
 * reflects feed semantics instead of inferring roles from titles or URLs.
 */
const CatalogSidebar: React.FC<CatalogSidebarProps> = ({
  navigationLinks,
  currentNavigationUrl = null,
  facetGroups,
  onNavigationSelect,
  onFacetSelect,
  isLoading = false,
}) => {
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [facetsOpen, setFacetsOpen] = useState(true);
  const [navigationQuery, setNavigationQuery] = useState('');
  const [showExpandedNavigation, setShowExpandedNavigation] = useState(false);
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);
  const [modalQuery, setModalQuery] = useState('');
  const viewAllButtonRef = useRef<HTMLButtonElement>(null);
  const modalSearchRef = useRef<HTMLInputElement>(null);
  const navigationModalRef = useFocusTrap<HTMLDivElement>({
    isActive: isNavigationModalOpen,
    onEscape: () => setIsNavigationModalOpen(false),
    initialFocusRef: modalSearchRef,
    returnFocusRef: viewAllButtonRef as React.RefObject<HTMLElement>,
  });

  const INLINE_LIMIT = 10;
  const EXPANDED_LIMIT = 24;
  const SEARCH_THRESHOLD = 12;
  const MODAL_THRESHOLD = 24;
  const hasNavigation = navigationLinks.length > 0;
  const hasFacets = facetGroups.some((group) => group.links.length > 0);
  const showNavigationSearch = navigationLinks.length > SEARCH_THRESHOLD;
  const showNavigationModalTrigger = navigationLinks.length > MODAL_THRESHOLD;

  const filteredNavigationLinks = useMemo(() => {
    const query = navigationQuery.trim().toLowerCase();
    if (!query) return navigationLinks;
    return navigationLinks.filter((link) => link.title.toLowerCase().includes(query));
  }, [navigationLinks, navigationQuery]);

  const visibleNavigationLinks = useMemo(() => {
    if (navigationLinks.length <= SEARCH_THRESHOLD) return filteredNavigationLinks;
    const limit = showExpandedNavigation ? EXPANDED_LIMIT : INLINE_LIMIT;
    return filteredNavigationLinks.slice(0, limit);
  }, [filteredNavigationLinks, navigationLinks.length, showExpandedNavigation]);

  const hiddenNavigationCount = Math.max(filteredNavigationLinks.length - visibleNavigationLinks.length, 0);

  const modalNavigationLinks = useMemo(() => {
    const query = modalQuery.trim().toLowerCase();
    if (!query) return navigationLinks;
    return navigationLinks.filter((link) => link.title.toLowerCase().includes(query));
  }, [modalQuery, navigationLinks]);

  useEffect(() => {
    setShowExpandedNavigation(false);
    setIsNavigationModalOpen(false);
    setModalQuery('');
  }, [currentNavigationUrl, navigationLinks]);

  if (!hasNavigation && !hasFacets && !isLoading) {
    return null;
  }

  const openNavigationModal = () => {
    setModalQuery(navigationQuery);
    setIsNavigationModalOpen(true);
  };

  const handleModalNavigationSelect = (link: CatalogNavigationLink) => {
    setIsNavigationModalOpen(false);
    onNavigationSelect(link);
  };

  const renderNavigationButton = (link: CatalogNavigationLink, index: number, onClick: (item: CatalogNavigationLink) => void) => {
    const isActive = !!currentNavigationUrl && link.url === currentNavigationUrl;
    return (
      <button
        key={`${link.url}-${index}`}
        onClick={() => onClick(link)}
        className={`w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
          isActive
            ? 'border-sky-400/40 bg-sky-500/20 text-sky-100'
            : 'border-transparent bg-sky-500/10 text-sky-200 hover:border-sky-500/30 hover:bg-sky-500/20'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="flex items-center gap-2.5">
          {link.thumbnail && (
            <img
              src={link.thumbnail}
              alt={`${link.title} thumbnail`}
              className="h-10 w-8 flex-shrink-0 rounded object-cover"
              loading="lazy"
              onError={(event) => {
                const img = event.currentTarget as HTMLImageElement;
                img.onerror = null as any;
                img.src = proxiedUrl(link.thumbnail as string);
              }}
            />
          )}
          <span className="min-w-0 truncate">{link.title}</span>
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 lg:sticky lg:top-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Browse</h3>
          <span className="text-[11px] text-slate-500">
            {navigationLinks.length + facetGroups.reduce((sum, group) => sum + group.links.length, 0)} options
          </span>
        </div>

        <div className="space-y-2.5">
          {hasNavigation && (
            <div className="overflow-hidden rounded-lg border border-slate-700/70">
              <button
                onClick={() => setNavigationOpen(!navigationOpen)}
                className="flex w-full items-center justify-between bg-slate-800/70 px-3 py-2 text-left transition-colors hover:bg-slate-800"
              >
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-300">Navigation</span>
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${navigationOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {navigationOpen && (
                <div className="space-y-2 bg-slate-900/30 p-2">
                  {showNavigationSearch && (
                    <input
                      type="search"
                      value={navigationQuery}
                      onChange={(event) => setNavigationQuery(event.target.value)}
                      placeholder={`Filter ${navigationLinks.length} links`}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none"
                      aria-label="Filter navigation links"
                    />
                  )}
                  {filteredNavigationLinks.length > 0 ? (
                    <>
                      <nav className="space-y-1.5">
                        {visibleNavigationLinks.map((link, index) => renderNavigationButton(link, index, onNavigationSelect))}
                      </nav>
                      {navigationLinks.length > SEARCH_THRESHOLD && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {hiddenNavigationCount > 0 && (
                            <button
                              onClick={() => setShowExpandedNavigation(true)}
                              className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
                            >
                              Show {Math.min(hiddenNavigationCount, EXPANDED_LIMIT - INLINE_LIMIT)} more
                            </button>
                          )}
                          {showExpandedNavigation && filteredNavigationLinks.length > INLINE_LIMIT && (
                            <button
                              onClick={() => setShowExpandedNavigation(false)}
                              className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
                            >
                              Show less
                            </button>
                          )}
                          {showNavigationModalTrigger && (
                            <button
                              ref={viewAllButtonRef}
                              onClick={openNavigationModal}
                              className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-500/20"
                            >
                              View all ({filteredNavigationLinks.length})
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="rounded-md bg-slate-900 px-2.5 py-3 text-sm text-slate-400">
                      No navigation links match that filter.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {hasFacets && (
            <div className="overflow-hidden rounded-lg border border-slate-700/70">
              <button
                onClick={() => setFacetsOpen(!facetsOpen)}
                className="flex w-full items-center justify-between bg-slate-800/70 px-3 py-2 text-left transition-colors hover:bg-slate-800"
              >
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-300">Facets</span>
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${facetsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {facetsOpen && (
                <div className="space-y-3 bg-slate-900/30 p-2">
                  {facetGroups.filter((group) => group.links.length > 0).map((group, groupIndex) => (
                    <div key={`${group.title}-${groupIndex}`}>
                      <p className="px-1.5 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{group.title}</p>
                      <nav className="space-y-1.5">
                        {group.links.map((link, index) => (
                          <button
                            key={`${link.url}-${index}`}
                            onClick={() => onFacetSelect(link)}
                            className={`flex w-full items-center justify-between gap-3 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
                              link.isActive
                                ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-100'
                                : 'border-transparent bg-slate-800/40 text-slate-300 hover:bg-slate-800/70'
                            }`}
                          >
                            <span className="truncate">{link.title}</span>
                            {typeof link.count === 'number' && (
                              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">{link.count}</span>
                            )}
                          </button>
                        ))}
                      </nav>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {isNavigationModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setIsNavigationModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="All navigation links"
        >
          <div
            ref={navigationModalRef}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <div>
                <h4 className="text-sm font-semibold text-white">All Navigation Links</h4>
                <p className="text-xs text-slate-400">{navigationLinks.length} total links</p>
              </div>
              <button
                onClick={() => setIsNavigationModalOpen(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close navigation browser"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-slate-700 px-4 py-3">
              <input
                ref={modalSearchRef}
                type="search"
                value={modalQuery}
                onChange={(event) => setModalQuery(event.target.value)}
                placeholder={`Search ${navigationLinks.length} links`}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none"
                aria-label="Search all navigation links"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {modalNavigationLinks.length > 0 ? (
                <nav className="space-y-1.5">
                  {modalNavigationLinks.map((link, index) => renderNavigationButton(link, index, handleModalNavigationSelect))}
                </nav>
              ) : (
                <p className="rounded-md bg-slate-950 px-3 py-4 text-sm text-slate-400">
                  No navigation links match that search.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CatalogSidebar;
