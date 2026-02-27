import React from 'react';

import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import * as hooks from '../../../../hooks';

// Render helper (no QueryClientProvider needed because we mock the data hook)
function wrap(node: React.ReactElement) {
  return node;
}

const initialCatalog = {
  id: 'cat-1',
  name: 'Test Catalog',
  url: 'https://example.com/opds/catalog',
  opdsVersion: 'auto',
};

const registryCatalog = {
  id: 'reg-1',
  name: 'Test Registry',
  url: 'https://example.com/opds/registry',
};

describe('CatalogView pagination history', () => {
  const useCatalogContentSpy = vi.spyOn(hooks as any, 'useCatalogContent');

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    cleanup();
  });

  it('navigates back using local history when feed omits prev', async () => {
    // First render: catalog with next link but no prev
    useCatalogContentSpy.mockImplementation(() => ({
      data: {
        books: [{ id: 'b1', title: 'Book 1', metadata: { title: 'Book 1' } }],
        navigationLinks: [],
        facetGroups: [],
        pagination: { next: 'https://example.com/opds/catalog?page=2' },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }));

    const CatalogViewModule = await import('../CatalogView');
    const CatalogView = CatalogViewModule.default;

    const setCatalogNavPath = vi.fn();

    const { rerender } = render(wrap(
      <CatalogView
        activeOpdsSource={initialCatalog as any}
        catalogNavPath={[{ name: initialCatalog.name, url: initialCatalog.url }]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={() => {}}
      />,
    ));

    // The Next button should be present and enabled
    const nextBtn = await screen.findByRole('button', { name: /next page/i });
    expect(nextBtn).toBeEnabled();

    // Mock the hook for the second page: has no prev, but we will rely on local history
    useCatalogContentSpy.mockReturnValueOnce({
      data: {
        books: [{ id: 'b2', title: 'Book 2', metadata: { title: 'Book 2' } }],
        navigationLinks: [],
        facetGroups: [],
        pagination: { next: 'https://example.com/opds/catalog?page=3' },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Simulate clicking Next; CatalogView will call setCatalogNavPath with new url
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    // assert that setCatalogNavPath was invoked (navigation to new page)
    expect(setCatalogNavPath).toHaveBeenCalled();

    // Now simulate that the component shows the second page and exposes a Previous synthesized
    // Provide a return value for the hook representing page 2 with a synthesized prev absent from feed
    useCatalogContentSpy.mockReturnValueOnce({
      data: {
        books: [{ id: 'b2', title: 'Book 2', metadata: { title: 'Book 2' } }],
        navigationLinks: [],
        facetGroups: [],
        pagination: { next: undefined, prev: undefined },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Re-render with the new nav path (page 2)
    await act(async () => {
      rerender(wrap(
        <CatalogView
          activeOpdsSource={initialCatalog as any}
          catalogNavPath={[{ name: initialCatalog.name, url: 'https://example.com/opds/catalog?page=2' }]}
          setCatalogNavPath={setCatalogNavPath}
          onShowBookDetail={() => {}}
        />,
      ));
    });

    // Now the CatalogNavigation should render a Previous button that is enabled due to synthesized prev
    const prevBtn = await screen.findByRole('button', { name: /previous page/i });
    // It should be enabled because CatalogView synthesizes prev via pageHistory
    expect(prevBtn).toBeEnabled();

    // Clicking Previous should call setCatalogNavPath to go back
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(setCatalogNavPath).toHaveBeenCalled();
  });

  it('clears history when switching active source or clicking breadcrumb', async () => {
    useCatalogContentSpy.mockImplementation(() => ({
      data: {
        books: [{ id: 'b1', title: 'Book 1', metadata: { title: 'Book 1' } }],
        navigationLinks: [],
        facetGroups: [],
        pagination: { next: 'https://example.com/opds/catalog?page=2' },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }));

    const CatalogViewModule = await import('../CatalogView');
    const CatalogView = CatalogViewModule.default;

    const setCatalogNavPath = vi.fn();

    const { rerender } = render(wrap(
      <CatalogView
        activeOpdsSource={initialCatalog as any}
        catalogNavPath={[{ name: initialCatalog.name, url: initialCatalog.url }]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={() => {}}
      />,
    ));

    // Simulate clicking Next to build history
    useCatalogContentSpy.mockReturnValueOnce({
      data: {
        books: [{ id: 'b2', title: 'Book 2', metadata: { title: 'Book 2' } }],
        navigationLinks: [],
        facetGroups: [],
        pagination: { next: 'https://example.com/opds/catalog?page=3' },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Simulate Next
    const nextBtn = await screen.findByRole('button', { name: /next page/i });
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    // Now simulate switching to another active source (registry) which should reset history
    useCatalogContentSpy.mockReturnValueOnce({
      data: { books: [], navigationLinks: [], facetGroups: [], pagination: {} },
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    await act(async () => {
      rerender(wrap(
        <CatalogView
          activeOpdsSource={registryCatalog as any}
          catalogNavPath={[{ name: registryCatalog.name, url: registryCatalog.url }]}
          setCatalogNavPath={setCatalogNavPath}
          onShowBookDetail={() => {}}
        />,
      ));
    });

    // Since the new source is loading, expect no Previous button in the loading state
    expect(screen.queryByRole('button', { name: /previous page/i })).not.toBeInTheDocument();

    // Rerender back to original catalog and ensure history is cleared (no prev synthesized)
    useCatalogContentSpy.mockReturnValueOnce({
      data: {
        books: [{ id: 'b1', title: 'Book 1', metadata: { title: 'Book 1' } }],
        navigationLinks: [],
        facetGroups: [],
        pagination: { next: undefined, prev: undefined },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await act(async () => {
      rerender(wrap(
        <CatalogView
          activeOpdsSource={initialCatalog as any}
          catalogNavPath={[{ name: initialCatalog.name, url: initialCatalog.url }]}
          setCatalogNavPath={setCatalogNavPath}
          onShowBookDetail={() => {}}
        />,
      ));
    });

    // No Previous button should be present because history was reset
    expect(screen.queryByRole('button', { name: /previous page/i })).not.toBeInTheDocument();
  });
});
