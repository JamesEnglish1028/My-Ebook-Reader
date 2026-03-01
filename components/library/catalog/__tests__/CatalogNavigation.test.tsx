import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CatalogNavigation from '../CatalogNavigation';

describe('CatalogNavigation', () => {
  it('renders first and last pagination buttons when those links are available', () => {
    const onPaginationClick = vi.fn();

    render(
      <CatalogNavigation
        navPath={[{ name: 'Catalog', url: 'https://example.org/catalog' }]}
        pagination={{
          first: 'https://example.org/catalog?page=1',
          prev: 'https://example.org/catalog?page=2',
          next: 'https://example.org/catalog?page=4',
          last: 'https://example.org/catalog?page=10',
        }}
        onBreadcrumbClick={vi.fn()}
        onPaginationClick={onPaginationClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /first page/i }));
    fireEvent.click(screen.getByRole('button', { name: /last page/i }));

    expect(onPaginationClick).toHaveBeenNthCalledWith(1, 'https://example.org/catalog?page=1');
    expect(onPaginationClick).toHaveBeenNthCalledWith(2, 'https://example.org/catalog?page=10');
  });

  it('renders a result range summary when pagination counts are available', () => {
    render(
      <CatalogNavigation
        navPath={[{ name: 'Catalog', url: 'https://example.org/catalog' }]}
        pagination={{
          totalResults: 42,
          itemsPerPage: 10,
          startIndex: 11,
        }}
        onBreadcrumbClick={vi.fn()}
        onPaginationClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Showing 11-20 of 42')).toBeInTheDocument();
  });
});
