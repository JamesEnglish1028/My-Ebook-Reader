import { useQuery } from '@tanstack/react-query';

import type { CatalogSearchMetadata, OpenSearchDescriptionDocument } from '../types';
import { fetchOpenSearchDescription } from '../services';

export const catalogSearchKeys = {
  all: ['catalog-search'] as const,
  description: (descriptionUrl: string) => ['catalog-search', 'description', descriptionUrl] as const,
};

export function useCatalogSearchDescription(
  search: CatalogSearchMetadata | null | undefined,
  enabled: boolean = true,
) {
  return useQuery<OpenSearchDescriptionDocument>({
    queryKey: catalogSearchKeys.description(search?.descriptionUrl || ''),
    queryFn: async () => {
      if (!search?.descriptionUrl) {
        throw new Error('No OpenSearch description URL provided');
      }

      return fetchOpenSearchDescription(search.descriptionUrl);
    },
    enabled: enabled && !!search?.descriptionUrl,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
