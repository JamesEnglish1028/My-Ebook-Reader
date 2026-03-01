import React from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function createCatalogContentResult(data: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    data: {
      books: [],
      navigationLinks: [],
      facetGroups: [],
      pagination: {},
      search: null,
      ...data,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as any;
}

function createResolvedSearchResult(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      activeTemplate: {
        template: 'https://example.com/opds/search{?searchTerms}',
        type: 'application/atom+xml;profile=opds-catalog',
        method: 'GET',
        params: [{ name: 'searchTerms', required: true }],
      },
    },
    isLoading: false,
    error: null,
    ...overrides,
  } as any;
}

const activeCatalog = {
  id: 'cat-1',
  name: 'Test Catalog',
  url: 'https://example.com/opds/catalog',
  opdsVersion: 'auto',
};

describe('CatalogView search', () => {
  const mockUseCatalogContent = vi.mocked(useCatalogContent);
  const mockUseResolvedCatalogSearch = vi.mocked(useResolvedCatalogSearch);

  beforeEach(() => {
    vi.resetAllMocks();
    mockUseResolvedCatalogSearch.mockReturnValue(createResolvedSearchResult());
  });

  afterEach(() => {
    cleanup();
  });

  it('submits a remote catalog search using the OpenSearch template', async () => {
    mockUseCatalogContent.mockReturnValue(createCatalogContentResult({
      search: {
        kind: 'opensearch',
        descriptionUrl: 'https://example.com/opensearch.xml',
        type: 'application/opensearchdescription+xml',
        title: 'Search catalog',
        rel: 'search',
      },
    }));

    const setCatalogNavPath = vi.fn();

    render(
      <CatalogView
        activeOpdsSource={activeCatalog as any}
        catalogNavPath={[{ name: activeCatalog.name, url: activeCatalog.url }]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={() => {}}
      />,
    );

    await act(async () => {
      fireEvent.change(
        await screen.findByRole('searchbox', { name: /search this catalog/i }),
        { target: { value: 'history of science' } },
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    });

    expect(setCatalogNavPath).toHaveBeenCalledWith([
      { name: activeCatalog.name, url: activeCatalog.url },
      {
        name: 'Search: history of science',
        url: 'https://example.com/opds/search?searchTerms=history%20of%20science',
      },
    ]);
  });

  it('clears an active remote search back to the prior navigation path', async () => {
    const searchUrl = 'https://example.com/opds/search?searchTerms=history';
    const rootResult = createCatalogContentResult({
      search: {
        kind: 'opensearch',
        descriptionUrl: 'https://example.com/opensearch.xml',
        type: 'application/opensearchdescription+xml',
        title: 'Search catalog',
        rel: 'search',
      },
    });
    const searchResult = createCatalogContentResult({
      books: [{
        title: 'Result Book',
        author: 'Author',
        coverImage: null,
        downloadUrl: 'https://example.com/books/result.epub',
        summary: null,
      }],
    });

    mockUseCatalogContent.mockImplementation((url) => (
      url === searchUrl ? searchResult : rootResult
    ));

    const setCatalogNavPath = vi.fn();
    const { rerender } = render(
      <CatalogView
        activeOpdsSource={activeCatalog as any}
        catalogNavPath={[{ name: activeCatalog.name, url: activeCatalog.url }]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={() => {}}
      />,
    );

    await act(async () => {
      fireEvent.change(
        await screen.findByRole('searchbox', { name: /search this catalog/i }),
        { target: { value: 'history' } },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    });

    await act(async () => {
      rerender(
        <CatalogView
          activeOpdsSource={activeCatalog as any}
          catalogNavPath={[
            { name: activeCatalog.name, url: activeCatalog.url },
            { name: 'Search: history', url: searchUrl },
          ]}
          setCatalogNavPath={setCatalogNavPath}
          onShowBookDetail={() => {}}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Clear' }));
    });

    expect(setCatalogNavPath).toHaveBeenLastCalledWith([
      { name: activeCatalog.name, url: activeCatalog.url },
    ]);
  });

  it('shows search loader errors and disables submission when no active template is available', async () => {
    mockUseCatalogContent.mockReturnValue(createCatalogContentResult({
      search: {
        kind: 'opensearch',
        descriptionUrl: 'https://example.com/opensearch.xml',
        type: 'application/opensearchdescription+xml',
        title: 'Search catalog',
        rel: 'search',
      },
    }));
    mockUseResolvedCatalogSearch.mockReturnValue(createResolvedSearchResult({
      data: {
        activeTemplate: undefined,
      },
      error: new Error('Search description unavailable'),
    }));

    render(
      <CatalogView
        activeOpdsSource={activeCatalog as any}
        catalogNavPath={[{ name: activeCatalog.name, url: activeCatalog.url }]}
        setCatalogNavPath={vi.fn()}
        onShowBookDetail={() => {}}
      />,
    );

    expect(await screen.findByText('Search description unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  });

  it('submits a remote catalog search using an inline OPDS 2 query template', async () => {
    mockUseCatalogContent.mockReturnValue(createCatalogContentResult({
      search: {
        kind: 'opds2-template',
        template: 'https://example.com/opds2/search{?query,title,author}',
        templated: true,
        type: 'application/opds+json',
        title: 'Search catalog',
        rel: 'search',
        params: [
          { name: 'query', required: true },
          { name: 'title', required: false },
          { name: 'author', required: false },
        ],
      },
    }));
    mockUseResolvedCatalogSearch.mockReturnValue(createResolvedSearchResult({
      data: {
        activeTemplate: {
          template: 'https://example.com/opds2/search{?query,title,author}',
          type: 'application/opds+json',
          method: 'GET',
          params: [
            { name: 'query', required: true },
            { name: 'title', required: false },
            { name: 'author', required: false },
          ],
        },
      },
    }));

    const setCatalogNavPath = vi.fn();

    render(
      <CatalogView
        activeOpdsSource={activeCatalog as any}
        catalogNavPath={[{ name: activeCatalog.name, url: activeCatalog.url }]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={() => {}}
      />,
    );

    await act(async () => {
      fireEvent.change(
        await screen.findByRole('searchbox', { name: /search query/i }),
        { target: { value: 'archives' } },
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    });

    expect(setCatalogNavPath).toHaveBeenCalledWith([
      { name: activeCatalog.name, url: activeCatalog.url },
      {
        name: 'Search: archives',
        url: 'https://example.com/opds2/search?query=archives',
      },
    ]);
  });

  it('includes optional advanced OPDS 2 search fields when provided', async () => {
    mockUseCatalogContent.mockReturnValue(createCatalogContentResult({
      search: {
        kind: 'opds2-template',
        template: 'https://example.com/opds2/search{?query,title,author}',
        templated: true,
        type: 'application/opds+json',
        title: 'Search catalog',
        rel: 'search',
        params: [
          { name: 'query', required: true },
          { name: 'title', required: false },
          { name: 'author', required: false },
        ],
      },
    }));
    mockUseResolvedCatalogSearch.mockReturnValue(createResolvedSearchResult({
      data: {
        activeTemplate: {
          template: 'https://example.com/opds2/search{?query,title,author}',
          type: 'application/opds+json',
          method: 'GET',
          params: [
            { name: 'query', required: true },
            { name: 'title', required: false },
            { name: 'author', required: false },
          ],
        },
      },
    }));

    const setCatalogNavPath = vi.fn();

    render(
      <CatalogView
        activeOpdsSource={activeCatalog as any}
        catalogNavPath={[{ name: activeCatalog.name, url: activeCatalog.url }]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={() => {}}
      />,
    );

    await act(async () => {
      fireEvent.change(
        await screen.findByRole('searchbox', { name: /search query/i }),
        { target: { value: 'archives' } },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Show Advanced' }));
    });

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
        target: { value: 'Caliban' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'Author' }), {
        target: { value: 'Sigma' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    });

    expect(setCatalogNavPath).toHaveBeenCalledWith([
      { name: activeCatalog.name, url: activeCatalog.url },
      {
        name: 'Search: archives',
        url: 'https://example.com/opds2/search?query=archives&title=Caliban&author=Sigma',
      },
    ]);
  });
});
