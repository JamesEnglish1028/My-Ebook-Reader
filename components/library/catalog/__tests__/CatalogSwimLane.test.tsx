import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CatalogSwimLane from '../CatalogSwimLane';

describe('CatalogSwimLane', () => {
  const laneLink = {
    title: 'Featured',
    url: 'https://demo.palaceproject.io/groups/featured',
    rel: 'collection',
    source: 'navigation' as const,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests a preview when IntersectionObserver is unavailable', async () => {
    const onRequestPreview = vi.fn();
    const originalObserver = (window as Window & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    // @ts-expect-error intentional test override
    window.IntersectionObserver = undefined;

    try {
      render(
        <CatalogSwimLane
          laneTitle="Featured"
          laneLink={laneLink}
          books={[]}
          hasFetched={false}
          onRequestPreview={onRequestPreview}
          onOpenLane={vi.fn()}
          onBookClick={vi.fn()}
        />,
      );

      await waitFor(() => expect(onRequestPreview).toHaveBeenCalledWith(laneLink));
    } finally {
      window.IntersectionObserver = originalObserver;
    }
  });

  it('explains when a lane opens to nested groups instead of preview books', () => {
    render(
      <CatalogSwimLane
        laneTitle="Featured"
        laneLink={laneLink}
        books={[]}
        hasFetched={true}
        hasChildNavigation={true}
        onOpenLane={vi.fn()}
        onBookClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/opens to nested groups/i)).toBeInTheDocument();
    expect(screen.getByText(/open lane/i)).toBeInTheDocument();
  });

  it('extracts item counts from lane titles and shows them in the subtitle', () => {
    render(
      <CatalogSwimLane
        laneTitle="Featured (17)"
        laneLink={laneLink}
        books={[]}
        hasFetched={true}
        onOpenLane={vi.fn()}
        onBookClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /open featured/i })).toBeInTheDocument();
    expect(screen.getByText('Featured')).toBeInTheDocument();
    expect(screen.getByText(/17 items/i)).toBeInTheDocument();
  });
});
