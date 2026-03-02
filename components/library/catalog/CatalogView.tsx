import React, { useEffect, useMemo, useState } from 'react';

import { useCatalogContent, useResolvedCatalogSearch } from '../../../hooks';
import {
  cachePatronAuthorizationForUrl,
  buildOpenSearchUrl,
  findCredentialForUrl,
  getAuthorizationForAuthDocument,
  getCachedAuthDocumentForUrl,
  getCachedPatronAuthorizationForUrl,
  saveOpdsCredential,
} from '../../../services';
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
  CatalogSearchMetadata,
  CatalogSearchTemplateParameter,
  RequestAuthorization,
} from '../../../types';
import OpdsCredentialsModal from '../../OpdsCredentialsModal';
import { Error as ErrorDisplay, Loading } from '../../shared';
import { AdjustmentsVerticalIcon, SearchIcon } from '../../icons';
import { CatalogFilters, CatalogNavigation, CatalogSearch, CatalogSidebar } from '../catalog';
import { BookGrid, EmptyState } from '../shared';

interface CatalogViewProps {
  activeOpdsSource: Catalog | CatalogRegistry;
  catalogNavPath: { name: string; url: string }[];
  setCatalogNavPath: React.Dispatch<React.SetStateAction<{ name: string; url: string }[]>>;
  onShowBookDetail: (book: CatalogBook, source: 'catalog', catalogName?: string) => void;
  importedProviderIds?: Set<string>;
}

const isPalaceHost = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.endsWith('palace.io')
      || hostname.endsWith('palaceproject.io')
      || hostname.endsWith('thepalaceproject.org')
      || hostname === 'palace.io'
      || hostname.endsWith('.palace.io')
      || hostname.endsWith('.thepalaceproject.org');
  } catch {
    return false;
  }
};

const isUnsupportedPalaceLoansLink = (
  title: string | undefined,
  url: string | undefined,
  rel?: string,
  type?: string,
): boolean => {
  const normalizedTitle = (title || '').trim().toLowerCase();
  const normalizedUrl = (url || '').toLowerCase();
  const normalizedRel = (rel || '').toLowerCase();
  const normalizedType = (type || '').toLowerCase();
  const isLoansByTitle = normalizedTitle === 'loans' || normalizedTitle === 'my loans';
  const isLoansByUrl = normalizedUrl.includes('/loans');

  if (!isLoansByTitle && !isLoansByUrl) return false;

  return isLoansByUrl
    || normalizedRel.includes('loan')
    || normalizedRel.includes('acquisition')
    || normalizedType.includes('kind=acquisition')
    || normalizedType.includes('profile=opds-catalog');
};

const getHostFromUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

const isPalaceLoansLink = (
  sourceUrl: string | undefined,
  title: string | undefined,
  url: string | undefined,
  rel?: string,
  type?: string,
): boolean => isPalaceHost(sourceUrl || '') && isUnsupportedPalaceLoansLink(title, url, rel, type);

const getDisplayLinkTitle = (
  sourceUrl: string | undefined,
  title: string | undefined,
  url: string | undefined,
  rel?: string,
  type?: string,
): string => (
  isPalaceLoansLink(sourceUrl, title, url, rel, type) ? 'My Loans' : (title || '')
);

type PendingLoansTarget =
  | { kind: 'navigation'; link: CatalogNavigationLink }
  | { kind: 'facet'; link: CatalogFacetLink };

interface SessionCredentialState {
  auth: RequestAuthorization;
  version: number;
}

const CatalogView: React.FC<CatalogViewProps> = ({
  activeOpdsSource,
  catalogNavPath,
  setCatalogNavPath,
  onShowBookDetail,
  importedProviderIds,
}) => {
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('all');
  const [fictionMode, setFictionMode] = useState<FictionMode>('all');
  const [mediaMode, setMediaMode] = useState<MediaMode>('all');
  const [publicationMode, setPublicationMode] = useState<PublicationMode>('all');
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>('all');
  const [distributorMode, setDistributorMode] = useState<DistributorMode>('all');
  const [catalogBooks, setCatalogBooks] = useState<CatalogBook[]>([]);
  const [pageHistory, setPageHistory] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchAdvancedValues, setSearchAdvancedValues] = useState<Record<string, string>>({});
  const [activeSearchQuery, setActiveSearchQuery] = useState<string | null>(null);
  const [searchOriginPath, setSearchOriginPath] = useState<{ name: string; url: string }[] | null>(null);
  const [catalogSearch, setCatalogSearch] = useState<CatalogSearchMetadata | null>(null);
  const [searchActionError, setSearchActionError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [sessionCredentialsByHost, setSessionCredentialsByHost] = useState<Record<string, SessionCredentialState>>({});
  const [pendingLoansTarget, setPendingLoansTarget] = useState<PendingLoansTarget | null>(null);

  const currentUrl = catalogNavPath.length > 0
    ? catalogNavPath[catalogNavPath.length - 1].url
    : activeOpdsSource?.url || null;

  const opdsVersion = (activeOpdsSource && 'opdsVersion' in activeOpdsSource)
    ? (activeOpdsSource as any).opdsVersion || 'auto'
    : 'auto';
  const currentHost = getHostFromUrl(currentUrl);
  const currentSessionCredentials = currentHost ? sessionCredentialsByHost[currentHost] : undefined;
  const cachedCurrentRequestAuth = currentUrl ? getCachedPatronAuthorizationForUrl(currentUrl) : null;
  const currentRequestAuth = currentSessionCredentials
    ? currentSessionCredentials.auth
    : cachedCurrentRequestAuth;
  const currentAuthKey = currentHost && (currentSessionCredentials || cachedCurrentRequestAuth)
    ? `${currentHost}:${currentSessionCredentials?.version || 'cached'}:${currentRequestAuth?.scheme || 'none'}`
    : '';

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
    currentRequestAuth,
    currentAuthKey,
  );

  const originalCatalogBooks = catalogData?.books || [];
  const navigationLinks = catalogData?.navigationLinks || [];
  const facetGroups = catalogData?.facetGroups || [];
  const catalogPagination = catalogData?.pagination || null;
  const discoveredSearch = catalogData?.search || null;

  useEffect(() => {
    setCatalogSearch(null);
    setSearchInput('');
    setSearchAdvancedValues({});
    setActiveSearchQuery(null);
    setSearchOriginPath(null);
    setSearchActionError(null);
  }, [activeOpdsSource?.id]);

  useEffect(() => {
    if (discoveredSearch) {
      setCatalogSearch(discoveredSearch);
    }
  }, [discoveredSearch]);

  const {
    data: resolvedSearch,
    isLoading: isSearchLoading,
    error: searchError,
  } = useResolvedCatalogSearch(catalogSearch, !!catalogSearch);

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
    if (currentRequestAuth?.scheme === 'bearer' && book.downloadUrl) {
      cachePatronAuthorizationForUrl(book.downloadUrl, currentRequestAuth);
    }
    onShowBookDetail(book, 'catalog', activeOpdsSource.name);
  };

  const handleSearchSubmit = () => {
    const query = searchInput.trim();
    const template = resolvedSearch?.activeTemplate;
    if (!query || !template) return;

    const templateParams = template.params || [];
    const primaryParam = templateParams.find((param) => param.name === 'searchTerms')?.name
      || templateParams.find((param) => param.name === 'query')?.name
      || templateParams.find((param) => param.required)?.name
      || templateParams[0]?.name
      || 'searchTerms';
    const searchValues = templateParams.reduce<Record<string, string>>((values, param) => {
      if (param.name === primaryParam) return values;
      const nextValue = searchAdvancedValues[param.name]?.trim();
      if (nextValue) {
        values[param.name] = nextValue;
      }
      return values;
    }, { [primaryParam]: query });

    let searchUrl: string;
    try {
      searchUrl = buildOpenSearchUrl(template, searchValues);
    } catch (error) {
      setSearchActionError(error instanceof Error ? error.message : 'Unable to build search URL.');
      return;
    }
    const basePath = activeSearchQuery && searchOriginPath
      ? searchOriginPath
      : (catalogNavPath.length > 0
        ? catalogNavPath
        : [{ name: activeOpdsSource.name, url: activeOpdsSource.url }]);
    const nextPath = [...basePath, { name: `Search: ${query}`, url: searchUrl }];

    setSearchOriginPath(basePath);
    setActiveSearchQuery(query);
    setSearchActionError(null);
    setCatalogNavPath(nextPath);
    setPageHistory([]);
  };

  const handleSearchClear = () => {
    if (searchOriginPath) {
      setCatalogNavPath(searchOriginPath);
    } else {
      setCatalogNavPath(
        catalogNavPath.slice(0, Math.max(catalogNavPath.length - 1, 0)),
      );
    }
    setActiveSearchQuery(null);
    setSearchOriginPath(null);
    setSearchInput('');
    setSearchAdvancedValues({});
    setSearchActionError(null);
    setPageHistory([]);
  };

  const handleAdvancedSearchChange = (name: string, value: string) => {
    setSearchAdvancedValues((prev) => ({ ...prev, [name]: value }));
  };

  const applyNavigationSelect = (link: CatalogNavigationLink) => {
    setCatalogNavPath((prev) => {
      const rel = (link.rel || '').toLowerCase();
      const rootPath = prev.length > 0
        ? prev
        : [{ name: activeOpdsSource.name, url: activeOpdsSource.url }];
      const existingIndex = rootPath.findIndex((item) => item.url === link.url);

      if (existingIndex >= 0) {
        return rootPath.slice(0, existingIndex + 1);
      }

      if (rel.includes('start')) {
        return [{ name: activeOpdsSource.name, url: activeOpdsSource.url }];
      }

      if (rel === 'up' || rel.endsWith('/up')) {
        if (rootPath.length > 1) {
          const next = [...rootPath];
          next[next.length - 1] = { name: link.title, url: link.url };
          return next;
        }
        return [{ name: activeOpdsSource.name, url: link.url }];
      }

      return [...rootPath, { name: link.title, url: link.url }];
    });
    resetLocalFilters();
    setPageHistory([]);
  };

  const applyFacetSelect = (link: CatalogFacetLink) => {
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

  const primeSessionAuthorization = (host: string, auth: RequestAuthorization) => {
    cachePatronAuthorizationForUrl(`https://${host}/`, auth);
    setSessionCredentialsByHost((prev) => {
      const prior = prev[host];
      return {
        ...prev,
        [host]: {
          auth,
          version: (prior?.version || 0) + 1,
        },
      };
    });
  };

  const handleLoansTargetSelect = async (target: PendingLoansTarget) => {
    const host = getHostFromUrl(target.link.url);
    if (!host) {
      if (target.kind === 'navigation') {
        applyNavigationSelect(target.link);
      } else {
        applyFacetSelect(target.link);
      }
      return;
    }

    const storedCredential = await findCredentialForUrl(target.link.url);
    const activeAuthDocument = catalogData?.authDocument || getCachedAuthDocumentForUrl(target.link.url);
    const cachedTokenAuth = getCachedPatronAuthorizationForUrl(target.link.url);
    if (cachedTokenAuth) {
      primeSessionAuthorization(host, cachedTokenAuth);
      if (target.kind === 'navigation') {
        applyNavigationSelect(target.link);
      } else {
        applyFacetSelect(target.link);
      }
      return;
    }
    if (storedCredential) {
      let nextAuth: RequestAuthorization = {
        scheme: 'basic',
        username: storedCredential.username,
        password: storedCredential.password,
      };
      if (activeAuthDocument) {
        nextAuth = await getAuthorizationForAuthDocument(
          activeAuthDocument,
          target.link.url,
          storedCredential.username,
          storedCredential.password,
        );
      }
      primeSessionAuthorization(host, nextAuth);
      if (target.kind === 'navigation') {
        applyNavigationSelect(target.link);
      } else {
        applyFacetSelect(target.link);
      }
      return;
    }

    setPendingLoansTarget(target);
  };

  const handleNavigationSelect = (link: CatalogNavigationLink) => {
    if (isPalaceLoansLink(activeOpdsSource?.url, link.title, link.url, link.rel, link.type)) {
      void handleLoansTargetSelect({ kind: 'navigation', link });
      return;
    }

    applyNavigationSelect(link);
  };

  const handleFacetSelect = (link: CatalogFacetLink) => {
    if (isPalaceLoansLink(activeOpdsSource?.url, link.title, link.url, link.rel, link.type)) {
      void handleLoansTargetSelect({ kind: 'facet', link });
      return;
    }

    applyFacetSelect(link);
  };

  const normalizedFacetGroups = useMemo(() => (
    facetGroups.map((group) => ({
      ...group,
      links: group.links.map((link) => ({
        ...link,
        title: getDisplayLinkTitle(activeOpdsSource?.url, link.title, link.url, link.rel, link.type),
        isActive: link.isActive ?? link.url === currentUrl,
      })),
    }))
  ), [activeOpdsSource?.url, currentUrl, facetGroups]);

  const displayNavigationLinks = useMemo(() => {
    if (!currentUrl) return navigationLinks;
    const filtered = navigationLinks
      .filter((link) => {
      if (link.url === currentUrl) return false;
      return true;
      })
      .map((link) => ({
        ...link,
        title: getDisplayLinkTitle(activeOpdsSource?.url, link.title, link.url, link.rel, link.type),
      }));
    if (filtered.length > 0) return filtered;
    return navigationLinks.map((link) => ({
      ...link,
      title: getDisplayLinkTitle(activeOpdsSource?.url, link.title, link.url, link.rel, link.type),
    }));
  }, [activeOpdsSource?.url, currentUrl, navigationLinks]);
  const searchTemplateParams = resolvedSearch?.activeTemplate?.params || [];
  const primarySearchParam = searchTemplateParams.find((param) => param.name === 'searchTerms')
    || searchTemplateParams.find((param) => param.name === 'query')
    || searchTemplateParams.find((param) => param.required)
    || searchTemplateParams[0]
    || null;
  const advancedSearchFields = searchTemplateParams.filter((param) => param.name !== primarySearchParam?.name);
  const primarySearchLabel = primarySearchParam?.name === 'query' ? 'Search query' : 'Search this catalog';
  const primarySearchPlaceholder = primarySearchParam?.name === 'query'
    ? 'Enter search keywords'
    : 'Search this catalog';
  const activeFilterCount = Number(audienceMode !== 'all')
    + Number(fictionMode !== 'all')
    + Number(mediaMode !== 'all')
    + Number(publicationMode !== 'all')
    + Number(availabilityMode !== 'all')
    + Number(distributorMode !== 'all');
  const hasSearchControl = !!catalogSearch;
  const hasFilterControl = availableAudiences.length > 1
    || availableFictionModes.length > 1
    || availableMediaModes.length > 1
    || availablePublicationTypes.length > 1
    || availableAvailabilityModes.length > 1
    || availableDistributors.length > 1;
  const hasSidebarContent = displayNavigationLinks.length > 0
    || normalizedFacetGroups.some((group) => group.links.length > 0);

  useEffect(() => {
    if (activeSearchQuery || searchActionError || searchError) {
      setIsSearchOpen(true);
    }
  }, [activeSearchQuery, searchActionError, searchError]);

  useEffect(() => {
    if (activeFilterCount > 0) {
      setIsFiltersOpen(true);
    }
  }, [activeFilterCount]);

  const serviceError = catalogData?.error || null;

  if (isLoading) {
    return <Loading variant="spinner" message="Loading catalog..." />;
  }

  if (error || serviceError) {
    return (
      <ErrorDisplay
        variant="page"
        title="Failed to Load Catalog"
        message={error?.message || serviceError || 'Could not load catalog content.'}
        onRetry={() => refetch()}
      />
    );
  }

  const hasBooks = catalogBooks.length > 0;
  const hasOriginalBooks = originalCatalogBooks.length > 0;
  const hasNavigationOnlyContent = !hasOriginalBooks && hasSidebarContent;
  const isEmptyFeed = !hasOriginalBooks && !hasSidebarContent;
  const pendingLoansAuthDocument = pendingLoansTarget
    ? (catalogData?.authDocument || getCachedAuthDocumentForUrl(pendingLoansTarget.link.url))
    : null;

  return (
    <>
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
          actions={(
            <>
              {hasSearchControl && (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen((prev) => !prev)}
                  className={`theme-button-neutral theme-hover-surface inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isSearchOpen ? 'theme-nav-link-active' : ''
                  }`}
                  aria-label={isSearchOpen ? 'Hide catalog search' : 'Open catalog search'}
                  title="Catalog search"
                >
                  <SearchIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              )}
              {hasFilterControl && (
                <button
                  type="button"
                  onClick={() => setIsFiltersOpen((prev) => !prev)}
                  className={`theme-button-neutral theme-hover-surface inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isFiltersOpen ? 'theme-nav-link-active' : ''
                  }`}
                  aria-label={isFiltersOpen ? 'Hide filters' : 'Open filters'}
                  title={activeFilterCount > 0 ? `${activeFilterCount} active filters` : 'Filters'}
                >
                  <AdjustmentsVerticalIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
                  </span>
                </button>
              )}
            </>
          )}
        />

        {catalogSearch && isSearchOpen && (
          <CatalogSearch
            value={searchInput}
            onChange={setSearchInput}
            primaryLabel={primarySearchLabel}
            primaryPlaceholder={primarySearchPlaceholder}
            advancedFields={advancedSearchFields as CatalogSearchTemplateParameter[]}
            advancedValues={searchAdvancedValues}
            onAdvancedChange={handleAdvancedSearchChange}
            onSubmit={handleSearchSubmit}
            onClear={handleSearchClear}
            disabled={isSearchLoading || !resolvedSearch?.activeTemplate}
            isLoading={isSearchLoading}
            errorMessage={searchActionError || (searchError instanceof Error ? searchError.message : null)}
            hasActiveSearch={!!activeSearchQuery}
          />
        )}

        {isFiltersOpen && (
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
        )}

        {isEmptyFeed ? (
          <EmptyState variant="catalog" />
        ) : hasBooks ? (
          <BookGrid
            books={catalogBooks}
            onBookClick={handleCatalogBookClick}
            isLoading={isLoading}
            importedProviderIds={importedProviderIds}
          />
        ) : hasOriginalBooks ? (
          <div className="theme-text-primary py-12 text-center">
            <p className="theme-text-secondary mb-2 text-lg">No books match your current filters</p>
            <p className="theme-text-muted text-sm">Try adjusting the local filters to see more books</p>
          </div>
        ) : hasNavigationOnlyContent ? (
          <div className="theme-surface-elevated theme-text-primary rounded-lg py-12 text-center">
            <p className="theme-text-secondary mb-2 text-lg">Choose a catalog section</p>
            <p className="theme-text-muted text-sm">
              Use the navigation and facet options to open a collection from this OPDS catalog.
            </p>
          </div>
        ) : null}
      </main>
      </div>

      <OpdsCredentialsModal
        isOpen={!!pendingLoansTarget}
        host={pendingLoansTarget ? getHostFromUrl(pendingLoansTarget.link.url) : null}
        authDocument={pendingLoansAuthDocument}
        onClose={() => setPendingLoansTarget(null)}
        onSubmit={async (username, password, save) => {
          if (!pendingLoansTarget) return;
          const host = getHostFromUrl(pendingLoansTarget.link.url);
          if (!host) {
            setPendingLoansTarget(null);
            return;
          }

          const normalizedUsername = username.trim();
          const normalizedPassword = password.trim();
          if (!normalizedUsername || !normalizedPassword) {
            return;
          }

          const nextAuth = pendingLoansAuthDocument
            ? await getAuthorizationForAuthDocument(
              pendingLoansAuthDocument,
              pendingLoansTarget.link.url,
              normalizedUsername,
              normalizedPassword,
            )
            : {
              scheme: 'basic' as const,
              username: normalizedUsername,
              password: normalizedPassword,
            };

          primeSessionAuthorization(host, nextAuth);
          if (save) {
            saveOpdsCredential(host, normalizedUsername, normalizedPassword);
          }

          const target = pendingLoansTarget;
          setPendingLoansTarget(null);
          if (target.kind === 'navigation') {
            applyNavigationSelect(target.link);
          } else {
            applyFacetSelect(target.link);
          }
        }}
        usernameLabel={!pendingLoansAuthDocument ? 'Library Card / Barcode' : undefined}
        passwordLabel={!pendingLoansAuthDocument ? 'PIN' : undefined}
        usernamePlaceholder={!pendingLoansAuthDocument ? 'Library card or barcode' : undefined}
        passwordPlaceholder={!pendingLoansAuthDocument ? 'PIN' : undefined}
        descriptionOverride={pendingLoansTarget && !pendingLoansAuthDocument
          ? `Enter your library card and PIN for ${getHostFromUrl(pendingLoansTarget.link.url)} to open your loans feed.`
          : undefined}
        saveLabel="Save credential for this Palace catalog"
        probeUrl={pendingLoansTarget?.link.url || null}
      />
    </>
  );
};

export default CatalogView;
