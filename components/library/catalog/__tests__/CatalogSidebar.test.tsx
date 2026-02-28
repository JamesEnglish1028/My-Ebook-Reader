import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CatalogSidebar from '../CatalogSidebar';

describe('CatalogSidebar', () => {
  it('renders navigation and facets separately and dispatches the correct handlers', () => {
    const onNavigationSelect = vi.fn();
    const onFacetSelect = vi.fn();

    render(
      <CatalogSidebar
        navigationLinks={[
          { title: 'Browse by Subject', url: 'https://example.org/navigation/subjects', rel: 'subsection', source: 'navigation' },
        ]}
        facetGroups={[
          {
            title: 'Availability',
            links: [
              { title: 'Available now', url: 'https://example.org/feed?availability=available', count: 12, isActive: true },
            ],
          },
        ]}
        onNavigationSelect={onNavigationSelect}
        onFacetSelect={onFacetSelect}
      />,
    );

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Facets')).toBeInTheDocument();
    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText('Browse by Subject')).toBeInTheDocument();
    expect(screen.getByText('Available now')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Browse by Subject' }));
    fireEvent.click(screen.getByRole('button', { name: /Available now/i }));

    expect(onNavigationSelect).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Browse by Subject' }),
    );
    expect(onFacetSelect).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Available now' }),
    );
  });
});
