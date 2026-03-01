import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCatalogContent, useResolvedCatalogSearch } from '../../../../hooks';
import CatalogView from '../CatalogView';

vi.mock('../../../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../hooks')>();
  return {
    ...actual,
    useCatalogContent: vi.fn(),
    useResolvedCatalogSearch: vi.fn(),
  };
});

describe('CatalogView OPDS2 navigation-only feeds', () => {
  it('shows navigation guidance instead of a blank main pane', () => {
    const opds2Catalog = {
      id: 'opds2-1',
      name: 'OPDS 2 Catalog',
      url: 'https://example.org/opds2/catalog',
      opdsVersion: '2',
    };

    vi.mocked(useCatalogContent).mockReturnValue({
      data: {
        books: [],
        navigationLinks: [
          {
            title: 'Fiction',
            url: 'https://example.org/opds2/catalog/fiction',
            rel: 'subsection',
            type: 'application/opds+json',
            source: 'navigation' as const,
          },
        ],
        facetGroups: [],
        pagination: {},
        search: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useResolvedCatalogSearch).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any);

    render(
      <CatalogView
        activeOpdsSource={opds2Catalog as any}
        catalogNavPath={[{ name: opds2Catalog.name, url: opds2Catalog.url }]}
        setCatalogNavPath={vi.fn()}
        onShowBookDetail={vi.fn()}
      />,
    );

    expect(screen.getByText('Browse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fiction' })).toBeInTheDocument();
    expect(screen.getByText('Choose a catalog section')).toBeInTheDocument();
    expect(screen.getByText(/use the navigation and facet options/i)).toBeInTheDocument();
  });
});
