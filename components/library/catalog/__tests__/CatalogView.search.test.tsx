import React from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCatalogContent, useCatalogSearchDescription } from '../../../../hooks';
import CatalogView from '../CatalogView';

vi.mock('../../../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../hooks')>();
  return {
    ...actual,
    useCatalogContent: vi.fn(),
    useCatalogSearchDescription: vi.fn(),
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

function createSearchDescriptionResult(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      shortName: 'Catalog Search',
      urls: [
        {
          template: 'https://example.com/opds/search{?searchTerms}',
          type: 'application/atom+xml;profile=opds-catalog',
          method: 'GET',
          params: [{ name: 'searchTerms', required: true }],
        },
      ],
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
  const mockUseCatalogSearchDescription = vi.mocked(useCatalogSearchDescription);

  beforeEach(() => {
    vi.resetAllMocks();
    mockUseCatalogSearchDescription.mockReturnValue(createSearchDescriptionResult());
  });

  afterEach(() => {
    cleanup();
  });

  it('submits a remote catalog search using the OpenSearch template', async () => {
    mockUseCatalogContent.mockReturnValue(createCatalogContentResult({
      search: {
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
        descriptionUrl: 'https://example.com/opensearch.xml',
        type: 'application/opensearchdescription+xml',
        title: 'Search catalog',
        rel: 'search',
      },
    }));
    mockUseCatalogSearchDescription.mockReturnValue(createSearchDescriptionResult({
      data: {
        shortName: 'Catalog Search',
        urls: [],
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
});
