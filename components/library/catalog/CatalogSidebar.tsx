import React, { useState } from 'react';

import type { CatalogFacetGroup, CatalogFacetLink, CatalogNavigationLink } from '../../../types';

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
  const hasNavigation = navigationLinks.length > 0;
  const hasFacets = facetGroups.some((group) => group.links.length > 0);

  if (!hasNavigation && !hasFacets && !isLoading) {
    return null;
  }

  return (
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
              <nav className="space-y-1.5 bg-slate-900/30 p-2">
                {navigationLinks.map((link, index) => {
                  const isActive = !!currentNavigationUrl && link.url === currentNavigationUrl;
                  return (
                  <button
                    key={`${link.url}-${index}`}
                    onClick={() => onNavigationSelect(link)}
                    className={`w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? 'border-sky-400/40 bg-sky-500/20 text-sky-100'
                        : 'border-transparent bg-sky-500/10 text-sky-200 hover:border-sky-500/30 hover:bg-sky-500/20'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {link.title}
                  </button>
                  );
                })}
              </nav>
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
  );
};

export default CatalogSidebar;
