import { useMemo } from 'react';

import type {
  CatalogSearchMetadata,
  OpenSearchTemplateParameter,
  OpenSearchUrlTemplate,
} from '../types';
import { useCatalogSearchDescription } from './useCatalogSearchDescription';

interface ResolvedCatalogSearchData {
  shortName?: string;
  activeTemplate?: OpenSearchUrlTemplate;
}

export function useResolvedCatalogSearch(
  search: CatalogSearchMetadata | null | undefined,
  enabled: boolean = true,
) {
  const openSearchResult = useCatalogSearchDescription(
    search,
    enabled && search?.kind === 'opensearch',
  );

  const inlineTemplateData = useMemo<ResolvedCatalogSearchData | null>(() => {
    if (search?.kind !== 'opds2-template' || !search.template) {
      return null;
    }

    return {
      shortName: search.title,
      activeTemplate: {
        template: search.template,
        type: search.type,
        method: 'GET',
        rel: search.rel,
        params: (search.params || []) as OpenSearchTemplateParameter[],
      },
    };
  }, [search]);

  if (search?.kind === 'opds2-template') {
    return {
      data: inlineTemplateData,
      isLoading: false,
      error: null,
    };
  }

  return {
    data: openSearchResult.data
      ? {
        shortName: openSearchResult.data.shortName,
        activeTemplate: openSearchResult.data.activeTemplate,
      }
      : null,
    isLoading: openSearchResult.isLoading,
    error: openSearchResult.error,
  };
}
