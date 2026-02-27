
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { opdsParserService } from '../../domain/catalog';
import { useCatalogContent } from '../useCatalogContent';

vi.mock('../../domain/catalog', async () => {
  const actual = await vi.importActual<typeof import('../../domain/catalog')>('../../domain/catalog');
  return {
    ...actual,
    opdsParserService: {
      fetchCatalog: vi.fn().mockResolvedValue({
        success: true,
        data: {
          books: [{ id: '1', title: 'Book 1' }],
          navigationLinks: [],
          facetGroups: [],
          pagination: {},
        },
      }),
    },
  };
});

describe('useCatalogContent', () => {
  it('fetches and returns catalog content', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCatalogContent('url', 'base', 'auto'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(opdsParserService.fetchCatalog).toHaveBeenCalledWith('url', 'base', 'auto');
    expect(result.current.data?.books[0].title).toBe('Book 1');
    expect(result.current.data?.navigationLinks).toEqual([]);
    expect(result.current.data?.facetGroups).toEqual([]);
  });
});
