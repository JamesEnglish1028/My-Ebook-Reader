import React, { useEffect, useMemo, useState } from 'react';

import { useCatalogContent } from '../../../hooks';
import {
  filterBooksByAudience,
  filterBooksByAvailability,
  filterBooksByDistributor,
  filterBooksByFiction,
  filterBooksByMedia,
  filterBooksByPublication,
  getAvailableAudiences,
  getAvailableAvailabilityModes,
  getAvailableDistributors,
  getAvailableFictionModes,
  getAvailableMediaModes,
  getAvailablePublicationTypes,
} from '../../../services/opds';
import type {
  AudienceMode,
  AvailabilityMode,
  Catalog,
  CatalogBook,
  CatalogFacetLink,
  CatalogNavigationLink,
  CatalogRegistry,
  DistributorMode,
  FictionMode,
  MediaMode,
  PublicationMode,
} from '../../../types';
import { Error as ErrorDisplay, Loading } from '../../shared';
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
  const [publicationMode, setPublicationMode] = useState<PublicationMode>('all');
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>('all');
  const [distributorMode, setDistributorMode] = useState<DistributorMode>('all');
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
    availablePublicationTypes,
    availableAvailabilityModes,
    availableDistributors,
  } = useMemo(() => ({
    availableAudiences: getAvailableAudiences(originalCatalogBooks),
    availableFictionModes: getAvailableFictionModes(originalCatalogBooks),
    availableMediaModes: getAvailableMediaModes(originalCatalogBooks),
    availablePublicationTypes: getAvailablePublicationTypes(originalCatalogBooks),
    availableAvailabilityModes: getAvailableAvailabilityModes(originalCatalogBooks),
    availableDistributors: getAvailableDistributors(originalCatalogBooks),
  }), [originalCatalogBooks]);

  useEffect(() => {
    if (originalCatalogBooks.length === 0) return;

    const audienceFiltered = filterBooksByAudience(originalCatalogBooks, audienceMode);
    const fictionFiltered = filterBooksByFiction(audienceFiltered, fictionMode);
    const mediaFiltered = filterBooksByMedia(fictionFiltered, mediaMode);
    const publicationFiltered = filterBooksByPublication(mediaFiltered, publicationMode);
    const availabilityFiltered = filterBooksByAvailability(publicationFiltered, availabilityMode);
    const distributorFiltered = filterBooksByDistributor(availabilityFiltered, distributorMode);

    setCatalogBooks(distributorFiltered);
  }, [
    audienceMode,
    fictionMode,
    mediaMode,
    publicationMode,
    availabilityMode,
    distributorMode,
    originalCatalogBooks,
  ]);

  const resetLocalFilters = () => {
    setAudienceMode('all');
    setFictionMode('all');
    setMediaMode('all');
    setPublicationMode('all');
    setAvailabilityMode('all');
    setDistributorMode('all');
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
        return [{ name: link.title, url: link.url }];
      }
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], name: link.title, url: link.url };
      return next;
    });
    resetLocalFilters();
    setPageHistory([]);
  };

  const normalizedFacetGroups = useMemo(() => {
    const hiddenFacetGroups = new Set(['formats', 'availability', 'distributor', 'distributors']);

    return facetGroups
      .filter((group) => !hiddenFacetGroups.has(group.title.trim().toLowerCase()))
      .map((group) => ({
      ...group,
      links: group.links.map((link) => ({
        ...link,
        isActive: link.isActive ?? link.url === currentUrl,
      })),
      }));
  }, [currentUrl, facetGroups]);

  const displayNavigationLinks = useMemo(() => {
    if (!currentUrl) return navigationLinks;
    const filtered = navigationLinks.filter((link) => link.url !== currentUrl);
    return filtered.length > 0 ? filtered : navigationLinks;
  }, [currentUrl, navigationLinks]);

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

  const hasBooks = catalogBooks.length > 0;
  const hasOriginalBooks = originalCatalogBooks.length > 0;
  const isEmptyFeed = !hasOriginalBooks && !hasSidebarContent;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {hasSidebarContent && (
        <aside className="order-2 w-full lg:order-1 lg:w-56 lg:flex-shrink-0">
          <CatalogSidebar
            navigationLinks={displayNavigationLinks}
            currentNavigationUrl={currentUrl}
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
          availablePublicationTypes={availablePublicationTypes}
          availableAvailabilityModes={availableAvailabilityModes}
          availableDistributors={availableDistributors}
          audienceMode={audienceMode}
          fictionMode={fictionMode}
          mediaMode={mediaMode}
          publicationMode={publicationMode}
          availabilityMode={availabilityMode}
          distributorMode={distributorMode}
          onAudienceChange={setAudienceMode}
          onFictionChange={setFictionMode}
          onMediaChange={setMediaMode}
          onPublicationChange={setPublicationMode}
          onAvailabilityChange={setAvailabilityMode}
          onDistributorChange={setDistributorMode}
        />

        {isEmptyFeed ? (
          <EmptyState variant="catalog" />
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
