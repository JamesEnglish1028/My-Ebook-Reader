import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { opdsParserService } from '../../../../domain/catalog';
import { parseOpds1Xml } from '../../../../services/opds';
import { useCatalogContent, useResolvedCatalogSearch } from '../../../../hooks';
import CatalogView from '../CatalogView';
import {
  palaceFeaturedLaneXml,
  palaceKidsLaneXml,
  palaceRootFeedXml,
} from './fixtures/palaceLaneFixtures';

vi.mock('../../../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../hooks')>();
  return {
    ...actual,
    useCatalogContent: vi.fn(),
    useResolvedCatalogSearch: vi.fn(),
  };
});

describe('CatalogView Palace swim lanes integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders parsed Palace child feeds and shows nested-lane guidance for child navigation feeds', async () => {
    const palaceCatalog = {
      id: 'palace-1',
      name: 'Palace Catalog',
      url: 'https://demo.palaceproject.io/catalog',
      opdsVersion: '1',
    };
    const fixtureFeeds: Record<string, string> = {
      'https://demo.palaceproject.io/groups/featured': palaceFeaturedLaneXml,
      'https://demo.palaceproject.io/groups/kids': palaceKidsLaneXml,
    };
    const rootFeed = parseOpds1Xml(palaceRootFeedXml, palaceCatalog.url);

    vi.spyOn(opdsParserService, 'fetchCatalog').mockImplementation(async (url: string) => {
      const xml = fixtureFeeds[url];
      if (!xml) {
        return {
          success: false as const,
          error: `Missing test fixture for ${url}`,
        };
      }

      const parsed = parseOpds1Xml(xml, url);
      return {
        success: true as const,
        data: {
          books: parsed.books,
          navigationLinks: parsed.navLinks,
          facetGroups: parsed.facetGroups,
          pagination: parsed.pagination,
          search: parsed.search,
        },
      };
    });

    vi.mocked(useCatalogContent).mockReturnValue({
      data: {
        books: rootFeed.books,
        navigationLinks: rootFeed.navLinks,
        facetGroups: rootFeed.facetGroups,
        pagination: rootFeed.pagination,
        search: rootFeed.search,
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

    await waitFor(() => {
      expect(screen.getByLabelText('Palace Preview Book by Palace Author')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/opens to nested groups/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /open featured/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open kids/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open kids/i }));

    expect(setCatalogNavPath).toHaveBeenCalledTimes(1);
  });
});
