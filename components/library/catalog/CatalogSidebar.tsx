import React, { useState } from 'react';

import type { CatalogFacetGroup, CatalogFacetLink, CatalogNavigationLink } from '../../../types';

interface CatalogSidebarProps {
  /** Parsed catalog navigation links */
  navigationLinks: CatalogNavigationLink[];
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
    <div className="bg-slate-800/50 rounded-lg p-4 lg:sticky lg:top-4">
      <h3 className="text-lg font-semibold text-white mb-4">Browse</h3>

      <div className="space-y-3">
        {hasNavigation && (
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setNavigationOpen(!navigationOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/50 hover:bg-slate-700 transition-colors"
            >
              <span className="text-sm font-medium text-slate-200">Navigation</span>
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
              <nav className="p-2 space-y-1 bg-slate-800/30">
                {navigationLinks.map((link, index) => (
                  <button
                    key={`${link.url}-${index}`}
                    onClick={() => onNavigationSelect(link)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-transparent hover:border-sky-600/30"
                  >
                    {link.title}
                  </button>
                ))}
              </nav>
            )}
          </div>
        )}

        {hasFacets && (
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setFacetsOpen(!facetsOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/50 hover:bg-slate-700 transition-colors"
            >
              <span className="text-sm font-medium text-slate-200">Facets</span>
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
              <div className="p-2 space-y-3 bg-slate-800/30">
                {facetGroups.filter((group) => group.links.length > 0).map((group, groupIndex) => (
                  <div key={`${group.title}-${groupIndex}`}>
                    <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-slate-500">{group.title}</p>
                    <nav className="space-y-1">
                      {group.links.map((link, index) => (
                        <button
                          key={`${link.url}-${index}`}
                          onClick={() => onFacetSelect(link)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between gap-3 border ${
                            link.isActive
                              ? 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40'
                              : 'bg-slate-700/30 hover:bg-slate-700/60 text-slate-300 border-transparent'
                          }`}
                        >
                          <span className="truncate">{link.title}</span>
                          {typeof link.count === 'number' && (
                            <span className="text-xs text-slate-400">{link.count}</span>
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
