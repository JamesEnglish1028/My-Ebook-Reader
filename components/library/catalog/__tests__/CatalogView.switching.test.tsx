import React from 'react';

import { render, screen, act, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';

import { useCatalogContent } from '../../../../hooks';
import type { Catalog, CatalogRegistry } from '../../../../types';
import CatalogView from '../CatalogView';

vi.mock('../../../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../hooks')>();
  return {
    ...actual,
    useCatalogContent: vi.fn(),
  };
});

// Provide a test wrapper that supplies minimal props and mocks
const initialCatalog: Catalog = {
  id: 'cat-1',
  name: 'Test Catalog',
  url: 'https://example.com/opds/catalog',
  opdsVersion: 'auto',
};

const registryCatalog: CatalogRegistry = {
  id: 'reg-1',
  name: 'Test Registry',
  url: 'https://example.com/opds/registry',
};

// Minimal stub for onShowBookDetail
const onShowBookDetail = vi.fn();

function renderCatalogView(
  activeOpdsSource: Catalog | CatalogRegistry,
  catalogNavPath: { name: string; url: string }[],
) {
  return render(
    <CatalogView
      activeOpdsSource={activeOpdsSource as any}
      catalogNavPath={catalogNavPath}
      setCatalogNavPath={() => {}}
      onShowBookDetail={onShowBookDetail}
    />,
  );
}

describe('CatalogView - switching source clears display state while loading', () => {
  const mockUseCatalogContent = vi.mocked(useCatalogContent);

  afterEach(() => {
    vi.resetAllMocks();
    cleanup();
  });

  it('clears catalog display arrays when switching active source and repopulates after load', async () => {
    mockUseCatalogContent.mockImplementation(() => ({
      data: {
        books: [
          { id: 'b1', title: 'Book 1', collections: [{ title: 'Col A', href: 'https://example.com/opds/collection/col-a' }], metadata: { 'title': 'Book 1' } },
        ],
        navigationLinks: [
          { title: 'Col A', url: 'https://example.com/opds/collection/col-a', rel: 'collection' },
        ],
        facetGroups: [],
        pagination: {},
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any));

    const { rerender } = renderCatalogView(initialCatalog, [{ name: initialCatalog.name, url: initialCatalog.url }]);

    // Sanity: initial book and collection are rendered
    expect(await screen.findByText('Book 1')).toBeInTheDocument();
    expect(await screen.findByText('Col A')).toBeInTheDocument();

    // Next: simulate switching to a different registry where the new feed is still loading
    mockUseCatalogContent.mockReturnValueOnce({
      data: { books: [], navigationLinks: [], facetGroups: [], pagination: {} },
      isLoading: true, // simulate loading state for new source
      error: null,
      refetch: vi.fn(),
    } as any);

    // Rerender with new activeOpdsSource and nav path (loading)
    await act(async () => {
      rerender(
        <CatalogView
          activeOpdsSource={registryCatalog as any}
          catalogNavPath={[{ name: registryCatalog.name, url: registryCatalog.url }]}
          setCatalogNavPath={() => {}}
          onShowBookDetail={onShowBookDetail}
        />,
      );
    });

  // While loading, the previous book and collections should be removed
  expect(screen.queryByText('Book 1')).not.toBeInTheDocument();
  expect(screen.queryByText('Col A')).not.toBeInTheDocument();

  // And a loading indicator should be shown
  expect(await screen.findByText(/loading catalog/i)).toBeInTheDocument();

    // Finally: simulate the new feed finishing load with different content
    mockUseCatalogContent.mockReturnValueOnce({
      data: {
        books: [{ id: 'b2', title: 'Book 2', collections: [{ title: 'Col B', href: 'https://example.com/opds/collection/col-b' }], metadata: { 'title': 'Book 2' } }],
        navigationLinks: [
          { title: 'Col B', url: 'https://example.com/opds/collection/col-b', rel: 'collection' },
        ],
        facetGroups: [],
        pagination: {},
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    // Rerender again to reflect the loaded state
    await act(async () => {
      rerender(
        <CatalogView
          activeOpdsSource={registryCatalog as any}
          catalogNavPath={[{ name: registryCatalog.name, url: registryCatalog.url }]}
          setCatalogNavPath={() => {}}
          onShowBookDetail={onShowBookDetail}
        />,
      );
    });

  // New content should be present and loading indicator gone
  expect(await screen.findByText('Book 2')).toBeInTheDocument();
  expect(await screen.findByText('Col B')).toBeInTheDocument();
  expect(screen.queryByText(/loading catalog/i)).not.toBeInTheDocument();
  });
});
