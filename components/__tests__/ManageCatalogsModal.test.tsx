import React from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ManageCatalogsModal from '../ManageCatalogsModal';

vi.mock('../../hooks', () => ({
  useFocusTrap: () => ({ current: null }),
}));

describe('ManageCatalogsModal presets', () => {
  it('quick-adds a suggested catalog and disables duplicates', () => {
    const onAddCatalog = vi.fn();

    render(
      <ManageCatalogsModal
        isOpen
        onClose={vi.fn()}
        catalogs={[
          {
            id: 'existing',
            name: 'Project Gutenberg',
            url: 'http://165.227.102.164:8080/opds/',
            opdsVersion: '1',
          },
        ]}
        onAddCatalog={onAddCatalog}
        onDeleteCatalog={vi.fn()}
        onUpdateCatalog={vi.fn()}
        registries={[]}
        onAddRegistry={vi.fn()}
        onDeleteRegistry={vi.fn()}
        onUpdateRegistry={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Added' })).toBeDisabled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Quick Add' })[0]);

    expect(onAddCatalog).toHaveBeenCalledWith(
      'Standard Ebooks',
      'https://standardebooks.org/opds/all',
      'auto',
    );
  });

  it('quick-adds a suggested registry', () => {
    const onAddRegistry = vi.fn();

    render(
      <ManageCatalogsModal
        isOpen
        onClose={vi.fn()}
        catalogs={[]}
        onAddCatalog={vi.fn()}
        onDeleteCatalog={vi.fn()}
        onUpdateCatalog={vi.fn()}
        registries={[]}
        onAddRegistry={onAddRegistry}
        onDeleteRegistry={vi.fn()}
        onUpdateRegistry={vi.fn()}
      />,
    );

    const palacePreset = screen.getByText('Palace Libraries').closest('div.theme-surface-elevated');
    expect(palacePreset).not.toBeNull();
    fireEvent.click(within(palacePreset as HTMLElement).getByRole('button', { name: 'Quick Add' }));

    expect(onAddRegistry).toHaveBeenCalledWith(
      'Palace Libraries',
      'https://registry.palaceproject.io/libraries',
    );
  });
});
