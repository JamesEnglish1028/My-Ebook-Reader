import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCatalogContent, useResolvedCatalogSearch } from '../../../../hooks';
import { findCredentialForUrl } from '../../../../services';
import CatalogView from '../CatalogView';

vi.mock('../../../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../services')>();
  return {
    ...actual,
    findCredentialForUrl: vi.fn(),
    saveOpdsCredential: vi.fn(),
  };
});

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

  it('renames Palace Loans to My Loans and prompts for credentials before opening it', async () => {
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
            title: 'https://demo.palaceproject.io/loans',
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
                title: 'https://demo.palaceproject.io/loans',
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
    vi.mocked(findCredentialForUrl).mockResolvedValue(undefined);

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

    fireEvent.click(screen.getAllByRole('button', { name: 'My Loans' })[0]);

    await waitFor(() => expect(findCredentialForUrl).toHaveBeenCalledWith('https://demo.palaceproject.io/loans'));
    expect(setCatalogNavPath).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: 'My Loans' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Fiction' })).toHaveLength(2);
  });
});
