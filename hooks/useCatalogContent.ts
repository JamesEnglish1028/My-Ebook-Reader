import { useQuery } from '@tanstack/react-query';

import { opdsParserService } from '../domain/catalog';
import { logger } from '../services/logger';
import type { CatalogBook, CatalogNavigationLink, CatalogPagination } from '../types';

// Query keys for catalog content
export const catalogKeys = {
  all: ['catalogs'] as const,
  content: (url: string, baseUrl: string, opdsVersion: string) =>
    ['catalogs', 'content', url, baseUrl, opdsVersion] as const,
};

interface CatalogContentResult {
  books: CatalogBook[];
  navLinks: CatalogNavigationLink[];
  pagination: CatalogPagination;
  error: string | null;
}

/**
 * useCatalogContent - Query hook for fetching OPDS catalog content
 *
 * Fetches books and navigation links from an OPDS catalog feed.
 * Handles both OPDS 1.x and OPDS 2.0 formats automatically.
 *
 * @param url - The OPDS feed URL to fetch
 * @param baseUrl - The base catalog URL for resolving relative links
 * @param opdsVersion - OPDS version preference ('auto', '1', or '2')
 * @param enabled - Whether the query should run (default: true)
 * @returns Query result with catalog content
 *
 * @example
 * const { data, isLoading, error } = useCatalogContent(
 *   'https://example.com/opds',
 *   'https://example.com',
 *   'auto'
 * );
 */
export function useCatalogContent(
  url: string | null,
  baseUrl: string,
  opdsVersion: 'auto' | '1' | '2' = 'auto',
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: catalogKeys.content(url || '', baseUrl, opdsVersion),
    queryFn: async (): Promise<CatalogContentResult> => {
      if (!url) {
        return {
          books: [],
          navLinks: [],
          pagination: {},
          error: 'No URL provided',
        };
      }

      logger.debug(`[useCatalogContent] Fetching: ${url}`);

      const result = await opdsParserService.fetchCatalog(url, baseUrl, opdsVersion);
      if (!result.success) {
        return {
          books: [],
          navLinks: [],
          pagination: {},
          error: result.error,
        };
      }

      // Filter pagination URLs from navigation links for registry feeds
      const isFeedARegistry = result.data.navLinks.length > 0 && result.data.books.length === 0;
      let finalNavLinks = result.data.navLinks;

      if (isFeedARegistry && result.data.pagination) {
        const paginationUrls = Object.values(result.data.pagination).filter(
          (val): val is string => !!val,
        );
        finalNavLinks = result.data.navLinks.filter(
          nav => !paginationUrls.includes(nav.url),
        );
      }

      return {
        books: result.data.books,
        navLinks: finalNavLinks,
        pagination: result.data.pagination,
        error: null,
      };
    },
    enabled: enabled && !!url,
    // Keep catalog data fresh
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * useCatalogRootCollections - Extract root-level collections from catalog content
 *
 * Helper hook that processes catalog books and navigation links to identify
 * collections available at the catalog root level.
 *
 * @param books - Array of catalog books
 * @param navLinks - Array of catalog navigation links
 * @returns Array of collection names
 */
export function useCatalogRootCollections(
  books: CatalogBook[],
  navLinks: CatalogNavigationLink[],
): string[] {
  if (books.length === 0) return [];

  const rootCollections = new Set<string>();

  // From book metadata (publication-level collections)
  books.forEach(book => {
    if (book.collections && book.collections.length > 0) {
      book.collections.forEach(collection => {
        rootCollections.add(collection.title);
      });
    }
  });

  // From navigation links (catalog-level collections)
  navLinks.forEach(link => {
    if (link.rel === 'collection' || link.rel === 'subsection') {
      rootCollections.add(link.title);
    }
  });

  return Array.from(rootCollections);
}
