import React, { useEffect, useMemo, useState } from 'react';

import { useCatalogContent } from '../../../hooks';
import {
  filterBooksByAudience,
  filterBooksByFiction,
  filterBooksByMedia,
  getAvailableAudiences,
  getAvailableFictionModes,
  getAvailableMediaModes,
  groupBooksByMode,
} from '../../../services/opds';
import type {
  AudienceMode,
  Catalog,
  CatalogBook,
  CatalogFacetLink,
  CatalogNavigationLink,
  CatalogRegistry,
  CategorizationMode,
  CategoryLane,
  FictionMode,
  MediaMode,
} from '../../../types';
import { CategoryLaneComponent } from '../../CategoryLane';
import { Error as ErrorDisplay, Loading } from '../../shared';
import { UncategorizedLane } from '../../UncategorizedLane';
import { CatalogFilters, CatalogNavigation, CatalogSidebar } from '../catalog';
import { BookGrid, EmptyState } from '../shared';

interface CatalogViewProps {
  activeOpdsSource: Catalog | CatalogRegistry;
  catalogNavPath: { name: string; url: string }[];
  setCatalogNavPath: React.Dispatch<React.SetStateAction<{ name: string; url: string }[]>>;
  onShowBookDetail: (book: CatalogBook, source: 'catalog', catalogName?: string) => void;
}

const CatalogView: React.FC<CatalogViewProps> = ({
  activeOpdsSource,
  catalogNavPath,
  setCatalogNavPath,
  onShowBookDetail,
}) => {
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('all');
  const [fictionMode, setFictionMode] = useState<FictionMode>('all');
  const [mediaMode, setMediaMode] = useState<MediaMode>('all');
  const [categorizationMode, setCategorizationMode] = useState<CategorizationMode>('subject');
  const [showCategoryView, setShowCategoryView] = useState(false);
  const [categoryLanes, setCategoryLanes] = useState<CategoryLane[]>([]);
  const [uncategorizedBooks, setUncategorizedBooks] = useState<CatalogBook[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<CatalogBook[]>([]);
  const [pageHistory, setPageHistory] = useState<string[]>([]);

  const currentUrl = catalogNavPath.length > 0
    ? catalogNavPath[catalogNavPath.length - 1].url
    : activeOpdsSource?.url || null;

  const opdsVersion = (activeOpdsSource && 'opdsVersion' in activeOpdsSource)
    ? (activeOpdsSource as any).opdsVersion || 'auto'
    : 'auto';

  useEffect(() => {
    setCatalogBooks([]);
    setCategoryLanes([]);
    setUncategorizedBooks([]);
    setShowCategoryView(false);
  }, [currentUrl, activeOpdsSource?.id]);

  useEffect(() => {
    setPageHistory([]);
  }, [activeOpdsSource?.id]);

  const {
    data: catalogData,
    isLoading,
    error,
    refetch,
  } = useCatalogContent(
    currentUrl,
    activeOpdsSource?.url || '',
    opdsVersion,
    !!activeOpdsSource,
  );

  const originalCatalogBooks = catalogData?.books || [];
  const navigationLinks = catalogData?.navigationLinks || [];
  const facetGroups = catalogData?.facetGroups || [];
  const catalogPagination = catalogData?.pagination || null;

  const effectivePagination = useMemo(() => {
    if (!catalogPagination) return null;
    const prev = catalogPagination.prev || (pageHistory.length > 0 ? pageHistory[pageHistory.length - 1] : undefined);
    return { ...catalogPagination, prev };
  }, [catalogPagination, pageHistory]);

  const {
    availableAudiences,
    availableFictionModes,
    availableMediaModes,
    hasSubjectMetadata,
  } = useMemo(() => ({
    availableAudiences: getAvailableAudiences(originalCatalogBooks),
    availableFictionModes: getAvailableFictionModes(originalCatalogBooks),
    availableMediaModes: getAvailableMediaModes(originalCatalogBooks),
    hasSubjectMetadata: originalCatalogBooks.some((book) =>
      (Array.isArray(book.categories) && book.categories.length > 0)
      || (Array.isArray(book.subjects) && book.subjects.length > 0),
    ),
  }), [originalCatalogBooks]);

  useEffect(() => {
    if (originalCatalogBooks.length === 0) return;

    const audienceFiltered = filterBooksByAudience(originalCatalogBooks, audienceMode);
    const fictionFiltered = filterBooksByFiction(audienceFiltered, fictionMode);
    const mediaFiltered = filterBooksByMedia(fictionFiltered, mediaMode);

    if (categorizationMode === 'flat') {
      setCatalogBooks(mediaFiltered);
      setCategoryLanes([]);
      setUncategorizedBooks([]);
      setShowCategoryView(false);
      return;
    }

    if (hasSubjectMetadata) {
      const grouped = groupBooksByMode(
        mediaFiltered,
        [],
        catalogPagination || {},
        'subject',
        audienceMode,
        fictionMode,
        mediaMode,
        'all',
      );
      setCategoryLanes(grouped.categoryLanes);
      setUncategorizedBooks(grouped.uncategorizedBooks);
      setCatalogBooks([]);
      setShowCategoryView(true);
      return;
    }

    setCatalogBooks(mediaFiltered);
    setCategoryLanes([]);
    setUncategorizedBooks([]);
    setShowCategoryView(false);
  }, [
    audienceMode,
    catalogPagination,
    categorizationMode,
    fictionMode,
    hasSubjectMetadata,
    mediaMode,
    originalCatalogBooks,
  ]);

  const resetLocalFilters = () => {
    setAudienceMode('all');
    setFictionMode('all');
    setMediaMode('all');
  };

  const handleBreadcrumbClick = (index: number) => {
    setCatalogNavPath(catalogNavPath.slice(0, index + 1));
    resetLocalFilters();
    setPageHistory([]);
  };

  const handlePaginationClick = (url: string) => {
    setCatalogNavPath((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], url };
      return next;
    });

    setPageHistory((prevHist) => {
      try {
        if (!currentUrl) return prevHist;
        const last = prevHist[prevHist.length - 1];
        if (last && last === url) {
          return prevHist.slice(0, -1);
        }
        return [...prevHist, currentUrl];
      } catch {
        return prevHist;
      }
    });
  };

  const handleCatalogBookClick = (book: CatalogBook) => {
    onShowBookDetail(book, 'catalog', activeOpdsSource.name);
  };

  const handleNavigationSelect = (link: CatalogNavigationLink) => {
    setCatalogNavPath((prev) => [...prev, { name: link.title, url: link.url }]);
    resetLocalFilters();
    setPageHistory([]);
  };

  const handleFacetSelect = (link: CatalogFacetLink) => {
    setCatalogNavPath((prev) => {
      if (prev.length === 0) {
        return [{ name: activeOpdsSource.name, url: link.url }];
      }
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], url: link.url };
      return next;
    });
    resetLocalFilters();
    setPageHistory([]);
  };

  const normalizedFacetGroups = useMemo(() => (
    facetGroups.map((group) => ({
      ...group,
      links: group.links.map((link) => ({
        ...link,
        isActive: link.isActive ?? link.url === currentUrl,
      })),
    }))
  ), [currentUrl, facetGroups]);

  const currentFeedName = catalogNavPath.length > 0
    ? catalogNavPath[catalogNavPath.length - 1].name
    : activeOpdsSource.name;

  const displayNavigationLinks = useMemo(() => (
    navigationLinks.filter((link) => !(link.url === currentUrl && link.title === currentFeedName))
  ), [currentFeedName, currentUrl, navigationLinks]);

  const hasSidebarContent = displayNavigationLinks.length > 0
    || normalizedFacetGroups.some((group) => group.links.length > 0);

  if (isLoading) {
    return <Loading variant="spinner" message="Loading catalog..." />;
  }

  if (error) {
    return (
      <ErrorDisplay
        variant="page"
        title="Failed to Load Catalog"
        message={error?.message || 'Could not load catalog content.'}
        onRetry={() => refetch()}
      />
    );
  }

  const hasBooks = catalogBooks.length > 0 || categoryLanes.length > 0 || uncategorizedBooks.length > 0;
  const hasOriginalBooks = originalCatalogBooks.length > 0;

  if (!hasOriginalBooks && !hasSidebarContent) {
    return <EmptyState variant="catalog" />;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {hasSidebarContent && (
        <aside className="w-full lg:w-64 lg:flex-shrink-0 order-2 lg:order-1">
          <CatalogSidebar
            navigationLinks={displayNavigationLinks}
            facetGroups={normalizedFacetGroups}
            onNavigationSelect={handleNavigationSelect}
            onFacetSelect={handleFacetSelect}
            isLoading={isLoading}
          />
        </aside>
      )}

      <main className="flex-1 min-w-0 order-1 lg:order-2">
        <CatalogNavigation
          navPath={catalogNavPath}
          pagination={effectivePagination ?? catalogPagination}
          onBreadcrumbClick={handleBreadcrumbClick}
          onPaginationClick={handlePaginationClick}
          isLoading={isLoading}
        />

        <CatalogFilters
          availableAudiences={availableAudiences}
          availableFictionModes={availableFictionModes}
          availableMediaModes={availableMediaModes}
          audienceMode={audienceMode}
          fictionMode={fictionMode}
          mediaMode={mediaMode}
          onAudienceChange={setAudienceMode}
          onFictionChange={setFictionMode}
          onMediaChange={setMediaMode}
        />

        {hasSubjectMetadata && (
          <div className="flex items-center space-x-3 mb-6 px-4">
            <span className="text-sm text-slate-300 font-medium">View By:</span>
            <button
              onClick={() => setCategorizationMode(categorizationMode === 'subject' ? 'flat' : 'subject')}
              aria-label={`Switch to ${categorizationMode === 'subject' ? 'grid view' : 'lanes view'}`}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${categorizationMode === 'subject' ? 'bg-emerald-600' : 'bg-slate-600'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${categorizationMode === 'subject' ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
            <span className="text-sm text-slate-300">
              {categorizationMode === 'subject' ? 'Lanes' : 'Grid'}
            </span>
          </div>
        )}

        {showCategoryView && categoryLanes.length > 0 ? (
          <div className="space-y-8">
            {categoryLanes.map((lane) => (
              <CategoryLaneComponent
                key={lane.category.label}
                categoryLane={lane}
                onBookClick={handleCatalogBookClick}
              />
            ))}
            {uncategorizedBooks.length > 0 && (
              <UncategorizedLane
                books={uncategorizedBooks}
                onBookClick={handleCatalogBookClick}
              />
            )}
          </div>
        ) : hasBooks ? (
          <BookGrid
            books={catalogBooks}
            onBookClick={handleCatalogBookClick}
            isLoading={isLoading}
          />
        ) : hasOriginalBooks ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg mb-2">No books match your current filters</p>
            <p className="text-slate-500 text-sm">Try adjusting the local filters to see more books</p>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default CatalogView;
