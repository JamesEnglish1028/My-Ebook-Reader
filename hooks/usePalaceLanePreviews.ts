import { useEffect, useMemo, useRef, useState } from 'react';

import { opdsParserService } from '../domain/catalog';
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
      lanePreviewMapRef.current = {};
      setLanePreviewMap({});
      return;
    }

    setLanePreviewMap((prev) => {
      const next: Record<string, CatalogLanePreview> = {};

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
      return !existing || (!existing.isLoading && !existing.hasFetched);
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
        const result = await opdsParserService.fetchCatalog(link.url, baseUrl, '1');

        if (!result.success) {
          return {
            link,
            books: [],
            isLoading: false,
            error: result.error,
            hasFetched: true,
          };
        }

        return {
          link,
          books: result.data.books.slice(0, maxPreviewBooks),
          isLoading: false,
          hasFetched: true,
          hasChildNavigation: result.data.navigationLinks.length > 0,
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
