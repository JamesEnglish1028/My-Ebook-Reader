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

  it('requests a preview immediately when the lane is already near the viewport', async () => {
    const onRequestPreview = vi.fn();
    const observe = vi.fn();
    const disconnect = vi.fn();
    const originalObserver = window.IntersectionObserver;

    class MockIntersectionObserver {
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '240px 0px';
      thresholds = [0];
      constructor() {}
    }

    // @ts-expect-error intentional test override
    window.IntersectionObserver = MockIntersectionObserver;

    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 20,
      bottom: 320,
      left: 0,
      right: 240,
      width: 240,
      height: 300,
      toJSON: () => ({}),
    });

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
      expect(observe).not.toHaveBeenCalled();
      expect(disconnect).not.toHaveBeenCalled();
    } finally {
      rectSpy.mockRestore();
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

  it('renders the lane-specific preview error message', () => {
    render(
      <CatalogSwimLane
        laneTitle="Featured"
        laneLink={laneLink}
        books={[]}
        error="Preview unavailable: Palace lane previews need a configured CORS proxy for this feed."
        hasFetched={true}
        onOpenLane={vi.fn()}
        onBookClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/configured CORS proxy/i)).toBeInTheDocument();
  });

  it('keeps rendered books visible while a preview refresh is in flight', () => {
    render(
      <CatalogSwimLane
        laneTitle="Featured"
        laneLink={laneLink}
        books={[
          {
            title: 'Preview Book',
            author: 'Lane Author',
            coverImage: null,
            downloadUrl: 'https://demo.palaceproject.io/books/preview.epub',
            summary: null,
          },
        ]}
        isLoading={true}
        hasFetched={true}
        onOpenLane={vi.fn()}
        onBookClick={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Preview Book by Lane Author')).toBeInTheDocument();
    expect(screen.queryByLabelText(/featured loading/i)).not.toBeInTheDocument();
    expect(screen.getByText(/refreshing preview/i)).toBeInTheDocument();
  });
});
