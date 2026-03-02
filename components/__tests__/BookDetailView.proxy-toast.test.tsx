import React from 'react';

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';

import { resolveAcquisitionChainOpds1 } from '../../services/opds';
import BookDetailView from '../BookDetailView';
import { ToastProvider } from '../toast/ToastContext';
import ToastStack from '../toast/ToastStack';

// Mock services
vi.mock('../../services/opds', () => ({
  resolveAcquisitionChainOpds1: vi.fn(),
}));

const sampleCatalogBook = {
  title: 'Proxy Test Book',
  author: 'Tester',
  coverImage: null,
  downloadUrl: 'https://corsproxy.io/https://example.com/opds/acq',
  providerName: 'ExampleProvider',
  acquisitionMediaType: 'application/epub+zip',
  format: 'EPUB',
};

describe('BookDetailView proxy toast', () => {
  test('invokes import handler for catalog book', async () => {
    const onImportFromCatalog = vi.fn(async () => ({ success: true }));
    const onBack = vi.fn();
    const onReadBook = vi.fn();

    render(
      <ToastProvider>
        <BookDetailView
          book={sampleCatalogBook as any}
          source="catalog"
          catalogName="TestCatalog"
          onBack={onBack}
          onReadBook={onReadBook}
          onImportFromCatalog={onImportFromCatalog}
          importStatus={{ isLoading: false, message: '', error: null }}
          setImportStatus={() => {}}
        />
        <ToastStack />
      </ToastProvider>,
    );

    // Click the import button
    const btn = screen.getByRole('button', { name: /Import to My Shelf/i });
    await act(async () => userEvent.click(btn));

    expect(onImportFromCatalog).toHaveBeenCalled();
  });
});
