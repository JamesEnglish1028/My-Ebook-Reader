import React from 'react';

import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

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

// Render helper (no QueryClientProvider needed because we mock the data hook)
function wrap(node: React.ReactElement) {
  return node;
}

function createCatalogContentResult(data: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    data: {
      books: [],
      navigationLinks: [],
      facetGroups: [],
      pagination: {},
      ...data,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as any;
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
  const mockUseCatalogContent = vi.mocked(useCatalogContent);
  const mockUseCatalogSearchDescription = vi.mocked(useCatalogSearchDescription);

  beforeEach(() => {
    vi.resetAllMocks();
    mockUseCatalogSearchDescription.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
    cleanup();
  });

  it('navigates back using local history when feed omits prev', async () => {
    const pageTwoUrl = 'https://example.com/opds/catalog?page=2';
    const initialResult = createCatalogContentResult({
      books: [{ id: 'b1', title: 'Book 1', metadata: { title: 'Book 1' } }],
      pagination: { next: pageTwoUrl },
    });
    const pageTwoResult = createCatalogContentResult({
      books: [{ id: 'b2', title: 'Book 2', metadata: { title: 'Book 2' } }],
      pagination: { next: undefined, prev: undefined },
    });

    mockUseCatalogContent.mockImplementation((url) => (
      url === pageTwoUrl ? pageTwoResult : initialResult
    ));

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

    // Simulate clicking Next; CatalogView will call setCatalogNavPath with new url
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    // assert that setCatalogNavPath was invoked (navigation to new page)
    expect(setCatalogNavPath).toHaveBeenCalled();

    // Re-render with the new nav path (page 2)
    await act(async () => {
      rerender(wrap(
        <CatalogView
          activeOpdsSource={initialCatalog as any}
          catalogNavPath={[{ name: initialCatalog.name, url: pageTwoUrl }]}
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
    const pageTwoUrl = 'https://example.com/opds/catalog?page=2';
    const initialResult = createCatalogContentResult({
      books: [{ id: 'b1', title: 'Book 1', metadata: { title: 'Book 1' } }],
      pagination: { next: pageTwoUrl },
    });
    const pageTwoResult = createCatalogContentResult({
      books: [{ id: 'b2', title: 'Book 2', metadata: { title: 'Book 2' } }],
      pagination: { next: 'https://example.com/opds/catalog?page=3' },
    });
    const loadingResult = createCatalogContentResult({}, { isLoading: true });
    const resetResult = createCatalogContentResult({
      books: [{ id: 'b1', title: 'Book 1', metadata: { title: 'Book 1' } }],
      pagination: { next: undefined, prev: undefined },
    });
    let phase: 'initial' | 'registry' | 'reset' = 'initial';

    mockUseCatalogContent.mockImplementation((url) => {
      if (phase === 'registry' && url === registryCatalog.url) return loadingResult;
      if (phase === 'reset' && url === initialCatalog.url) return resetResult;
      if (url === pageTwoUrl) return pageTwoResult;
      return initialResult;
    });

    const setCatalogNavPath = vi.fn();

    const { rerender } = render(wrap(
      <CatalogView
        activeOpdsSource={initialCatalog as any}
        catalogNavPath={[{ name: initialCatalog.name, url: initialCatalog.url }]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={() => {}}
      />,
    ));

    // Simulate Next
    const nextBtn = await screen.findByRole('button', { name: /next page/i });
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    await act(async () => {
      rerender(wrap(
        <CatalogView
          activeOpdsSource={initialCatalog as any}
          catalogNavPath={[{ name: initialCatalog.name, url: pageTwoUrl }]}
          setCatalogNavPath={setCatalogNavPath}
          onShowBookDetail={() => {}}
        />,
      ));
    });

    // Now simulate switching to another active source (registry) which should reset history
    phase = 'registry';

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
    phase = 'reset';

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

  it('relabels the active breadcrumb when selecting a facet', async () => {
    mockUseCatalogContent.mockReturnValue(createCatalogContentResult({
        books: [{ id: 'b1', title: 'Book 1', metadata: { title: 'Book 1' } }],
        facetGroups: [
          {
            title: 'Subjects',
            links: [
              { title: 'Fantasy', url: 'https://example.com/opds/catalog?subject=fantasy', isActive: false },
            ],
          },
        ],
    }));

    const setCatalogNavPath = vi.fn();

    render(wrap(
      <CatalogView
        activeOpdsSource={initialCatalog as any}
        catalogNavPath={[{ name: initialCatalog.name, url: initialCatalog.url }]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={() => {}}
      />,
    ));

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Fantasy' }));
    });

    expect(setCatalogNavPath).toHaveBeenCalled();
    const updater = setCatalogNavPath.mock.calls[0][0];
    const nextPath = updater([{ name: initialCatalog.name, url: initialCatalog.url }]);

    expect(nextPath).toEqual([{ name: 'Fantasy', url: 'https://example.com/opds/catalog?subject=fantasy' }]);
  });

  it('collapses breadcrumbs instead of appending when following start or up links', async () => {
    mockUseCatalogContent.mockReturnValue(createCatalogContentResult({
      books: [],
      navigationLinks: [
        { title: 'Home', url: initialCatalog.url, rel: 'start', source: 'navigation' },
        { title: 'Back to Section', url: 'https://example.com/opds/catalog/section', rel: 'up', source: 'navigation' },
      ],
    }));

    const setCatalogNavPath = vi.fn();

    render(wrap(
      <CatalogView
        activeOpdsSource={initialCatalog as any}
        catalogNavPath={[
          { name: initialCatalog.name, url: initialCatalog.url },
          { name: 'Fantasy', url: 'https://example.com/opds/catalog?subject=fantasy' },
        ]}
        setCatalogNavPath={setCatalogNavPath}
        onShowBookDetail={() => {}}
      />,
    ));

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Home' }));
    });

    const startUpdater = setCatalogNavPath.mock.calls[0][0];
    const startPath = startUpdater([
      { name: initialCatalog.name, url: initialCatalog.url },
      { name: 'Fantasy', url: 'https://example.com/opds/catalog?subject=fantasy' },
    ]);
    expect(startPath).toEqual([
      { name: initialCatalog.name, url: initialCatalog.url },
    ]);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back to Section' }));
    });

    const upUpdater = setCatalogNavPath.mock.calls[1][0];
    const upPath = upUpdater([
      { name: initialCatalog.name, url: initialCatalog.url },
      { name: 'Fantasy', url: 'https://example.com/opds/catalog?subject=fantasy' },
    ]);
    expect(upPath).toEqual([
      { name: initialCatalog.name, url: initialCatalog.url },
      { name: 'Back to Section', url: 'https://example.com/opds/catalog/section' },
    ]);
  });
});
