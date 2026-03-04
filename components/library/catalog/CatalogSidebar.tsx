import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useFocusTrap } from '../../../hooks';
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
  const [facetSectionOpen, setFacetSectionOpen] = useState<Record<string, boolean>>({});
  const [navigationQuery, setNavigationQuery] = useState('');
  const [showExpandedNavigation, setShowExpandedNavigation] = useState(false);
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);
  const [modalQuery, setModalQuery] = useState('');
  const [activeFacetGroup, setActiveFacetGroup] = useState<CatalogFacetGroup | null>(null);
  const [facetModalQuery, setFacetModalQuery] = useState('');
  const viewAllButtonRef = useRef<HTMLButtonElement>(null);
  const facetViewAllButtonRef = useRef<HTMLButtonElement>(null);
  const modalSearchRef = useRef<HTMLInputElement>(null);
  const facetModalSearchRef = useRef<HTMLInputElement>(null);
  const navigationModalRef = useFocusTrap<HTMLDivElement>({
    isActive: isNavigationModalOpen,
    onEscape: () => setIsNavigationModalOpen(false),
    initialFocusRef: modalSearchRef,
    returnFocusRef: viewAllButtonRef as React.RefObject<HTMLElement>,
  });
  const facetModalRef = useFocusTrap<HTMLDivElement>({
    isActive: activeFacetGroup !== null,
    onEscape: () => setActiveFacetGroup(null),
    initialFocusRef: facetModalSearchRef,
    returnFocusRef: facetViewAllButtonRef as React.RefObject<HTMLElement>,
  });

  const INLINE_LIMIT = 10;
  const EXPANDED_LIMIT = 24;
  const SEARCH_THRESHOLD = 12;
  const MODAL_THRESHOLD = 24;
  const getNavigationLabelParts = (link: CatalogNavigationLink): { groupTitle?: string; linkTitle: string } => {
    if (link.source === 'group') {
      const match = link.title.match(/^([^:]+):\s+(.+)$/);
      if (match) {
        return { groupTitle: match[1].trim(), linkTitle: match[2].trim() };
      }
    }
    return { linkTitle: link.title };
  };
  const populatedFacetGroups = useMemo(
    () => facetGroups.filter((group) => group.links.length > 0),
    [facetGroups],
  );
  const hasNavigation = navigationLinks.length > 0;
  const hasFacets = populatedFacetGroups.length > 0;
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
  const visibleNavigationSections = useMemo(() => {
    const sections = new Map<string, { title?: string; links: CatalogNavigationLink[] }>();
    visibleNavigationLinks.forEach((link) => {
      const { groupTitle, linkTitle } = getNavigationLabelParts(link);
      const key = groupTitle || '__default__';
      if (!sections.has(key)) {
        sections.set(key, { title: groupTitle, links: [] });
      }
      const section = sections.get(key);
      if (!section) return;
      section.links.push({ ...link, title: linkTitle });
    });
    return Array.from(sections.values());
  }, [visibleNavigationLinks]);

  const modalNavigationLinks = useMemo(() => {
    const query = modalQuery.trim().toLowerCase();
    if (!query) return navigationLinks;
    return navigationLinks.filter((link) => link.title.toLowerCase().includes(query));
  }, [modalQuery, navigationLinks]);
  const modalNavigationSections = useMemo(() => {
    const sections = new Map<string, { title?: string; links: CatalogNavigationLink[] }>();
    modalNavigationLinks.forEach((link) => {
      const { groupTitle, linkTitle } = getNavigationLabelParts(link);
      const key = groupTitle || '__default__';
      if (!sections.has(key)) {
        sections.set(key, { title: groupTitle, links: [] });
      }
      const section = sections.get(key);
      if (!section) return;
      section.links.push({ ...link, title: linkTitle });
    });
    return Array.from(sections.values());
  }, [modalNavigationLinks]);
  const modalFacetLinks = useMemo(() => {
    if (!activeFacetGroup) return [];
    const query = facetModalQuery.trim().toLowerCase();
    if (!query) return activeFacetGroup.links;
    return activeFacetGroup.links.filter((link) => link.title.toLowerCase().includes(query));
  }, [activeFacetGroup, facetModalQuery]);

  useEffect(() => {
    setShowExpandedNavigation(false);
    setIsNavigationModalOpen(false);
    setModalQuery('');
  }, [currentNavigationUrl, navigationLinks]);

  useEffect(() => {
    setActiveFacetGroup(null);
    setFacetModalQuery('');
  }, [facetGroups]);

  useEffect(() => {
    setFacetSectionOpen((existing) => (
      populatedFacetGroups.reduce<Record<string, boolean>>((nextState, group, index) => {
        const groupKey = `${group.title}-${index}`;
        nextState[groupKey] = Object.prototype.hasOwnProperty.call(existing, groupKey)
          ? existing[groupKey]
          : group.links.length <= 6;
        return nextState;
      }, {})
    ));
  }, [populatedFacetGroups]);

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

  const openFacetModal = (group: CatalogFacetGroup) => {
    setFacetModalQuery('');
    setActiveFacetGroup(group);
  };

  const handleModalFacetSelect = (link: CatalogFacetLink) => {
    setActiveFacetGroup(null);
    onFacetSelect(link);
  };

  const renderNavigationButton = (link: CatalogNavigationLink, index: number, onClick: (item: CatalogNavigationLink) => void) => {
    const isActive = !!currentNavigationUrl && link.url === currentNavigationUrl;
    return (
      <button
        key={`${link.url}-${index}`}
        onClick={() => onClick(link)}
        className={`w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
          isActive
            ? 'theme-nav-link-active'
            : 'theme-nav-link'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        {link.title}
      </button>
    );
  };

  return (
    <>
      <div className="theme-surface theme-border rounded-xl border p-3 lg:sticky lg:top-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="theme-text-secondary text-xs font-semibold uppercase tracking-[0.18em]">Browse</h3>
          <span className="theme-text-muted text-[11px]">
            {navigationLinks.length + facetGroups.reduce((sum, group) => sum + group.links.length, 0)} options
          </span>
        </div>

        <div className="space-y-2.5">
          {hasNavigation && (
            <div className="theme-border overflow-hidden rounded-lg border">
              <button
                onClick={() => setNavigationOpen(!navigationOpen)}
                className="theme-surface-muted theme-hover-surface flex w-full items-center justify-between px-3 py-2 text-left transition-colors"
              >
                <span className="theme-text-secondary text-xs font-medium uppercase tracking-[0.14em]">Navigation</span>
                <svg
                  className={`theme-text-muted h-4 w-4 transition-transform ${navigationOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {navigationOpen && (
                <div className="theme-surface space-y-2 p-2">
                  {showNavigationSearch && (
                    <input
                      type="search"
                      value={navigationQuery}
                      onChange={(event) => setNavigationQuery(event.target.value)}
                      placeholder={`Filter ${navigationLinks.length} links`}
                      className="theme-input w-full rounded-md border px-2.5 py-2 text-sm focus:border-sky-500/50 focus:outline-none"
                      aria-label="Filter navigation links"
                    />
                  )}
                  {filteredNavigationLinks.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {visibleNavigationSections.map((section, sectionIndex) => (
                          <div key={`${section.title || 'default'}-${sectionIndex}`} className="space-y-1.5">
                            {section.title && (
                              <p className="theme-text-muted px-1 text-[11px] font-medium uppercase tracking-[0.14em]">
                                {section.title}
                              </p>
                            )}
                            <nav className="space-y-1.5">
                              {section.links.map((link, index) => renderNavigationButton(link, index, onNavigationSelect))}
                            </nav>
                          </div>
                        ))}
                      </div>
                      {navigationLinks.length > SEARCH_THRESHOLD && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {hiddenNavigationCount > 0 && (
                            <button
                              onClick={() => setShowExpandedNavigation(true)}
                              className="theme-button-neutral theme-hover-surface rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                            >
                              Show {Math.min(hiddenNavigationCount, EXPANDED_LIMIT - INLINE_LIMIT)} more
                            </button>
                          )}
                          {showExpandedNavigation && filteredNavigationLinks.length > INLINE_LIMIT && (
                            <button
                              onClick={() => setShowExpandedNavigation(false)}
                              className="theme-button-neutral theme-hover-surface rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                            >
                              Show less
                            </button>
                          )}
                          {showNavigationModalTrigger && (
                            <button
                              ref={viewAllButtonRef}
                              onClick={openNavigationModal}
                              className="theme-nav-link rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                            >
                              View all ({filteredNavigationLinks.length})
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="theme-surface-elevated theme-text-muted rounded-md px-2.5 py-3 text-sm">
                      No navigation links match that filter.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {hasFacets && (
            <div className="theme-border overflow-hidden rounded-lg border">
              <button
                onClick={() => setFacetsOpen(!facetsOpen)}
                className="theme-surface-muted theme-hover-surface flex w-full items-center justify-between px-3 py-2 text-left transition-colors"
              >
                <span className="theme-text-secondary text-xs font-medium uppercase tracking-[0.14em]">Facets</span>
                <svg
                  className={`theme-text-muted h-4 w-4 transition-transform ${facetsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {facetsOpen && (
                <div className="theme-surface space-y-3 p-2">
                  {populatedFacetGroups.map((group, groupIndex) => {
                    const groupKey = `${group.title}-${groupIndex}`;
                    const isGroupOpen = facetSectionOpen[groupKey] ?? true;
                    const visibleFacetLinks = group.links.slice(0, INLINE_LIMIT);
                    const hasFacetOverflow = group.links.length > INLINE_LIMIT;

                    return (
                      <div key={groupKey} className="theme-border overflow-hidden rounded-md border">
                        <button
                          onClick={() => setFacetSectionOpen((existing) => ({ ...existing, [groupKey]: !isGroupOpen }))}
                          className="theme-surface-muted theme-hover-surface flex w-full items-center justify-between gap-3 px-2.5 py-2 text-left transition-colors"
                          aria-expanded={isGroupOpen}
                          aria-controls={`facet-group-${groupIndex}`}
                        >
                          <span className="theme-text-muted text-[11px] font-medium uppercase tracking-[0.14em]">{group.title}</span>
                          <span className="flex items-center gap-2">
                            <span className="theme-surface-elevated theme-text-muted rounded-full px-2 py-0.5 text-[11px]">
                              {group.links.length}
                            </span>
                            <svg
                              className={`theme-text-muted h-4 w-4 transition-transform ${isGroupOpen ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </button>
                        {isGroupOpen && (
                          <nav id={`facet-group-${groupIndex}`} className="theme-surface space-y-1.5 p-2">
                            {visibleFacetLinks.map((link, index) => (
                              <button
                                key={`${link.url}-${index}`}
                                onClick={() => onFacetSelect(link)}
                                className={`flex w-full items-center justify-between gap-3 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
                                  link.isActive
                                    ? 'theme-selection-active'
                                    : 'theme-button-neutral border-transparent'
                                }`}
                              >
                                <span className="truncate">{link.title}</span>
                                {typeof link.count === 'number' && (
                                  <span className="theme-surface-elevated theme-text-muted rounded-full px-2 py-0.5 text-[11px]">{link.count}</span>
                                )}
                              </button>
                            ))}
                            {hasFacetOverflow && (
                              <button
                                ref={facetViewAllButtonRef}
                                onClick={() => openFacetModal(group)}
                                className="theme-nav-link mt-1 w-full rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-colors"
                              >
                                View all ({group.links.length})
                              </button>
                            )}
                          </nav>
                        )}
                      </div>
                    );
                  })}
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
            className="theme-surface-elevated theme-border theme-text-primary flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="theme-divider flex items-center justify-between border-b px-4 py-3">
              <div>
                <h4 className="theme-text-primary text-sm font-semibold">All Navigation Links</h4>
                <p className="theme-text-muted text-xs">{navigationLinks.length} total links</p>
              </div>
              <button
                onClick={() => setIsNavigationModalOpen(false)}
                className="theme-text-muted theme-hover-surface rounded-full p-2 transition-colors hover:text-sky-300"
                aria-label="Close navigation browser"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="theme-divider border-b px-4 py-3">
              <input
                ref={modalSearchRef}
                type="search"
                value={modalQuery}
                onChange={(event) => setModalQuery(event.target.value)}
                placeholder={`Search ${navigationLinks.length} links`}
                className="theme-input w-full rounded-md border px-3 py-2 text-sm focus:border-sky-500/50 focus:outline-none"
                aria-label="Search all navigation links"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {modalNavigationLinks.length > 0 ? (
                <div className="space-y-3">
                  {modalNavigationSections.map((section, sectionIndex) => (
                    <div key={`${section.title || 'default'}-modal-${sectionIndex}`} className="space-y-1.5">
                      {section.title && (
                        <p className="theme-text-muted px-1 text-[11px] font-medium uppercase tracking-[0.14em]">
                          {section.title}
                        </p>
                      )}
                      <nav className="space-y-1.5">
                        {section.links.map((link, index) => renderNavigationButton(link, index, handleModalNavigationSelect))}
                      </nav>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="theme-surface theme-text-muted rounded-md px-3 py-4 text-sm">
                  No navigation links match that search.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {activeFacetGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActiveFacetGroup(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`All ${activeFacetGroup.title} facet options`}
        >
          <div
            ref={facetModalRef}
            className="theme-surface-elevated theme-border theme-text-primary flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="theme-divider flex items-center justify-between border-b px-4 py-3">
              <div>
                <h4 className="theme-text-primary text-sm font-semibold">All {activeFacetGroup.title}</h4>
                <p className="theme-text-muted text-xs">{activeFacetGroup.links.length} total options</p>
              </div>
              <button
                onClick={() => setActiveFacetGroup(null)}
                className="theme-text-muted theme-hover-surface rounded-full p-2 transition-colors hover:text-sky-300"
                aria-label="Close facet browser"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="theme-divider border-b px-4 py-3">
              <input
                ref={facetModalSearchRef}
                type="search"
                value={facetModalQuery}
                onChange={(event) => setFacetModalQuery(event.target.value)}
                placeholder={`Search ${activeFacetGroup.links.length} options`}
                className="theme-input w-full rounded-md border px-3 py-2 text-sm focus:border-sky-500/50 focus:outline-none"
                aria-label={`Search all ${activeFacetGroup.title} facet options`}
              />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {modalFacetLinks.length > 0 ? (
                <nav className="space-y-1.5">
                  {modalFacetLinks.map((link, index) => (
                    <button
                      key={`${link.url}-modal-${index}`}
                      onClick={() => handleModalFacetSelect(link)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
                        link.isActive
                          ? 'theme-selection-active'
                          : 'theme-button-neutral border-transparent'
                      }`}
                    >
                      <span className="truncate">{link.title}</span>
                      {typeof link.count === 'number' && (
                        <span className="theme-surface-elevated theme-text-muted rounded-full px-2 py-0.5 text-[11px]">{link.count}</span>
                      )}
                    </button>
                  ))}
                </nav>
              ) : (
                <p className="theme-surface theme-text-muted rounded-md px-3 py-4 text-sm">
                  No facet options match that search.
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
