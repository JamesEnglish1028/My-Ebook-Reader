import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCatalogContent, useResolvedCatalogSearch } from '../../../../hooks';
import { usePalaceLanePreviews } from '../../../../hooks/usePalaceLanePreviews';
import CatalogView from '../CatalogView';

vi.mock('../../../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../hooks')>();
  return {
    ...actual,
    useCatalogContent: vi.fn(),
    useResolvedCatalogSearch: vi.fn(),
  };
});

vi.mock('../../../../hooks/usePalaceLanePreviews', () => ({
  usePalaceLanePreviews: vi.fn(),
}));

describe('CatalogView Palace swim lanes', () => {
  it('renders navigation-driven swim lanes for Palace feeds and uses lane headers for navigation', () => {
    const palaceCatalog = {
      id: 'palace-1',
      name: 'Palace Catalog',
      url: 'https://demo.palaceproject.io/catalog',
      opdsVersion: '1',
    };

    const laneLink = {
      title: 'Featured',
      url: 'https://demo.palaceproject.io/groups/featured',
      rel: 'collection',
      source: 'navigation' as const,
    };

    vi.mocked(useCatalogContent).mockReturnValue({
      data: {
        books: [],
        navigationLinks: [laneLink],
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

    vi.mocked(usePalaceLanePreviews).mockReturnValue({
      lanePreviews: [
        {
          link: laneLink,
          books: [
            {
              title: 'Preview Book',
              author: 'Lane Author',
              coverImage: null,
              downloadUrl: 'https://demo.palaceproject.io/books/preview.epub',
              summary: null,
            },
          ],
          isLoading: false,
        },
      ],
      isLoading: false,
      hasAnyBooks: true,
    });

    const setCatalogNavPath = vi.fn();

    render(
      <CatalogView
        activeOpdsSource={palaceCatalog as any}
        catalogNavPath={[{ name: palaceCatalog.name, url: palaceCatalog.url }]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /open featured/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Preview Book by Lane Author')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open featured/i }));

    expect(setCatalogNavPath).toHaveBeenCalledTimes(1);
  });

  it('progressively requests later lanes after earlier previews settle', async () => {
    const palaceCatalog = {
      id: 'palace-1',
      name: 'Palace Catalog',
      url: 'https://demo.palaceproject.io/catalog',
      opdsVersion: '1',
    };

    const laneLinks = [
      {
        title: 'Featured',
        url: 'https://demo.palaceproject.io/groups/featured',
        rel: 'collection',
        source: 'navigation' as const,
      },
      {
        title: 'Kids',
        url: 'https://demo.palaceproject.io/groups/kids',
        rel: 'collection',
        source: 'navigation' as const,
      },
      {
        title: 'Mystery',
        url: 'https://demo.palaceproject.io/groups/mystery',
        rel: 'collection',
        source: 'navigation' as const,
      },
    ];

    vi.mocked(useCatalogContent).mockReturnValue({
      data: {
        books: [],
        navigationLinks: laneLinks,
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

    vi.mocked(usePalaceLanePreviews).mockImplementation(({ links, requestedUrls }) => ({
      lanePreviews: links.map((link) => ({
        link,
        books: [],
        isLoading: false,
        hasFetched: requestedUrls.includes(link.url),
      })),
      isLoading: false,
      hasAnyBooks: false,
    }));

    render(
      <CatalogView
        activeOpdsSource={palaceCatalog as any}
        catalogNavPath={[{ name: palaceCatalog.name, url: palaceCatalog.url }]}
        setCatalogNavPath={vi.fn()}
        onShowBookDetail={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(vi.mocked(usePalaceLanePreviews)).toHaveBeenLastCalledWith(expect.objectContaining({
        requestedUrls: laneLinks.map((link) => link.url),
      }));
    });
  });
});
