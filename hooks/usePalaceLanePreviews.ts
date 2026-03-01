import { useEffect, useMemo, useRef, useState } from 'react';

import { opdsParserService } from '../domain/catalog';
import { proxiedUrl } from '../services';
import type { CatalogLanePreview, CatalogNavigationLink } from '../types';

interface UsePalaceLanePreviewsOptions {
  enabled: boolean;
  links: CatalogNavigationLink[];
  baseUrl: string;
  requestedUrls: string[];
  maxPreviewBooks?: number;
}

const DEFAULT_PREVIEW_BOOKS = 10;
const MAX_CONCURRENT_PREVIEW_FETCHES = 3;
const PALACE_PREVIEW_ACCEPT_HEADER = 'application/atom+xml;profile=opds-catalog, application/opds+json;q=0.9, application/xml, text/xml, application/json;q=0.8, */*;q=0.5';
const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;

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

const isCrossOriginWithoutProxy = (url: string): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const target = new URL(url);
    return target.origin !== window.location.origin && proxiedUrl(url) === url;
  } catch {
    return false;
  }
};

const isStalePreview = (preview?: CatalogLanePreview): boolean => {
  if (!preview?.hasFetched) return true;
  if (!preview.fetchedAt) return true;
  return (Date.now() - preview.fetchedAt) >= PREVIEW_CACHE_TTL_MS;
};

export function usePalaceLanePreviews({
  enabled,
  links,
  baseUrl,
  requestedUrls,
  maxPreviewBooks = DEFAULT_PREVIEW_BOOKS,
}: UsePalaceLanePreviewsOptions) {
  const [lanePreviewMap, setLanePreviewMap] = useState<Record<string, CatalogLanePreview>>({});
  const lanePreviewMapRef = useRef<Record<string, CatalogLanePreview>>({});

  const normalizedLinks = useMemo(
    () => links.filter((link) => Boolean(link?.url && link?.title)),
    [links],
  );
  const requestedUrlSet = useMemo(() => new Set(requestedUrls), [requestedUrls]);

  useEffect(() => {
    lanePreviewMapRef.current = lanePreviewMap;
  }, [lanePreviewMap]);

  useEffect(() => {
    if (!enabled || normalizedLinks.length === 0) {
      return;
    }

    setLanePreviewMap((prev) => {
      const next: Record<string, CatalogLanePreview> = { ...prev };

      normalizedLinks.forEach((link) => {
        next[link.url] = prev[link.url] || {
          link,
          books: [],
          isLoading: false,
          hasFetched: false,
        };
      });

      return next;
    });
  }, [enabled, normalizedLinks]);

  useEffect(() => {
    let isCancelled = false;

    if (!enabled || requestedUrlSet.size === 0) {
      return () => {
        isCancelled = true;
      };
    }

    const linksToFetch = normalizedLinks.filter((link) => {
      if (!requestedUrlSet.has(link.url)) return false;
      const existing = lanePreviewMapRef.current[link.url];
      return !existing || (!existing.isLoading && isStalePreview(existing));
    });

    if (linksToFetch.length === 0) {
      return () => {
        isCancelled = true;
      };
    }

    setLanePreviewMap((prev) => {
      const next = { ...prev };
      linksToFetch.forEach((link) => {
        next[link.url] = {
          ...(next[link.url] || {
            link,
            books: [],
            hasFetched: false,
          }),
          link,
          isLoading: true,
          error: undefined,
        };
      });
      return next;
    });

    void (async () => {
      const results: CatalogLanePreview[] = [];
      let nextIndex = 0;

      const fetchSingleLane = async (link: CatalogNavigationLink): Promise<CatalogLanePreview> => {
        const palaceLane = isPalaceHost(link.url);
        const proxyUrl = palaceLane ? proxiedUrl(link.url) : link.url;

        if (palaceLane && isCrossOriginWithoutProxy(link.url)) {
          return {
            link,
            books: [],
            isLoading: false,
            error: 'Preview unavailable: Palace lane previews need a configured CORS proxy for this feed.',
            hasFetched: true,
            fetchedAt: Date.now(),
          };
        }

        if (palaceLane && proxyUrl !== link.url) {
          try {
            const response = await fetch(proxyUrl, {
              method: 'GET',
              mode: 'cors',
              credentials: 'omit',
              headers: {
                Accept: PALACE_PREVIEW_ACCEPT_HEADER,
              },
            });

            if (!response.ok) {
              return {
                link,
                books: [],
                isLoading: false,
                error: `Preview unavailable: proxy request failed (${response.status}).`,
                hasFetched: true,
                fetchedAt: Date.now(),
              };
            }

            const responseText = await response.text();
            const parsed = await opdsParserService.parseOPDS(responseText, link.url);

            if (!parsed.success) {
              return {
                link,
                books: [],
                isLoading: false,
                error: parsed.error,
                hasFetched: true,
                fetchedAt: Date.now(),
              };
            }

            return {
              link,
              books: parsed.data.books.slice(0, maxPreviewBooks),
              isLoading: false,
              hasFetched: true,
              hasChildNavigation: parsed.data.navigationLinks.length > 0,
              fetchedAt: Date.now(),
            };
          } catch (error) {
            return {
              link,
              books: [],
              isLoading: false,
              error: error instanceof Error ? error.message : 'Preview unavailable.',
              hasFetched: true,
              fetchedAt: Date.now(),
            };
          }
        }

        const result = await opdsParserService.fetchCatalog(link.url, baseUrl, '1');

        if (!result.success) {
          return {
            link,
            books: [],
            isLoading: false,
            error: result.error,
            hasFetched: true,
            fetchedAt: Date.now(),
          };
        }

        return {
          link,
          books: result.data.books.slice(0, maxPreviewBooks),
          isLoading: false,
          hasFetched: true,
          hasChildNavigation: result.data.navigationLinks.length > 0,
          fetchedAt: Date.now(),
        };
      };

      const worker = async () => {
        while (true) {
          const currentIndex = nextIndex;
          nextIndex += 1;

          if (currentIndex >= linksToFetch.length) {
            return;
          }

          results[currentIndex] = await fetchSingleLane(linksToFetch[currentIndex]);
        }
      };

      const workerCount = Math.min(MAX_CONCURRENT_PREVIEW_FETCHES, linksToFetch.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (isCancelled) return;

      setLanePreviewMap((prev) => {
        const next = { ...prev };
        results.forEach((lane) => {
          next[lane.link.url] = lane;
        });
        return next;
      });
    })();

    return () => {
      isCancelled = true;
    };
  }, [baseUrl, enabled, maxPreviewBooks, normalizedLinks, requestedUrlSet]);

  const lanePreviews = useMemo(
    () => normalizedLinks.map((link) => lanePreviewMap[link.url] || {
      link,
      books: [],
      isLoading: false,
      hasFetched: false,
    }),
    [lanePreviewMap, normalizedLinks],
  );

  const isLoading = enabled && lanePreviews.some((lane) => lane.isLoading);
  const hasAnyBooks = lanePreviews.some((lane) => lane.books.length > 0);

  return {
    lanePreviews,
    isLoading,
    hasAnyBooks,
  };
}
