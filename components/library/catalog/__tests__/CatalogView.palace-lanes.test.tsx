import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
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

describe('CatalogView Palace feeds', () => {
  it('uses the standard sidebar and grid layout for Palace feeds', () => {
    const palaceCatalog = {
      id: 'palace-1',
      name: 'Palace Catalog',
      url: 'https://demo.palaceproject.io/catalog',
      opdsVersion: '1',
    };

    const navigationLink = {
      title: 'Featured',
      url: 'https://demo.palaceproject.io/groups/featured',
      rel: 'collection',
      source: 'navigation' as const,
    };

    vi.mocked(useCatalogContent).mockReturnValue({
      data: {
        books: [
          {
            title: 'Grid Book',
            author: 'Author',
            coverImage: null,
            downloadUrl: 'https://demo.palaceproject.io/books/grid.epub',
            summary: null,
          },
        ],
        navigationLinks: [navigationLink],
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

    const setCatalogNavPath = vi.fn();

    render(
      <CatalogView
        activeOpdsSource={palaceCatalog as any}
        catalogNavPath={[{ name: palaceCatalog.name, url: palaceCatalog.url }]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={vi.fn()}
      />,
    );

    expect(screen.getByText('Browse')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open featured/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Grid Book by Author')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Featured' }));
    expect(setCatalogNavPath).toHaveBeenCalledTimes(1);
  });

  it('suppresses unsupported Palace Loans links from sidebar navigation and facets', () => {
    const palaceCatalog = {
      id: 'palace-1',
      name: 'Palace Catalog',
      url: 'https://demo.palaceproject.io/catalog',
      opdsVersion: '1',
    };

    vi.mocked(useCatalogContent).mockReturnValue({
      data: {
        books: [],
        navigationLinks: [
          {
            title: 'Loans',
            url: 'https://demo.palaceproject.io/loans',
            rel: 'acquisition',
            type: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
            source: 'navigation' as const,
          },
          {
            title: 'Fiction',
            url: 'https://demo.palaceproject.io/groups/fiction',
            rel: 'collection',
            source: 'navigation' as const,
          },
        ],
        facetGroups: [
          {
            title: 'Collections',
            links: [
              {
                title: 'Loans',
                url: 'https://demo.palaceproject.io/loans',
                rel: 'facet',
                type: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
              },
              {
                title: 'Fiction',
                url: 'https://demo.palaceproject.io/groups/fiction',
                rel: 'facet',
              },
            ],
          },
        ],
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
        activeOpdsSource={palaceCatalog as any}
        catalogNavPath={[{ name: palaceCatalog.name, url: palaceCatalog.url }]}
        setCatalogNavPath={vi.fn()}
        onShowBookDetail={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Loans' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Fiction' })).toHaveLength(2);
  });
});
