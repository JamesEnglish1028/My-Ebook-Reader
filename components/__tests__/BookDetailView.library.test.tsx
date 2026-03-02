import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import BookDetailView from '../BookDetailView';
import { defaultImportStatus, libraryBook } from './fixtures/bookDetailViewFixtures';

const mockUseToast = vi.fn(() => ({
  showToast: vi.fn(),
}));
vi.mock('../toast/ToastContext', () => ({
  useToast: () => mockUseToast(),
}));

describe('BookDetailView Library Book UI', () => {
  afterEach(() => {
    cleanup();
  });

  test('shows Read Book button and providerName', () => {
    const mockProps = {
      book: libraryBook,
      source: 'library' as const,
      onBack: vi.fn(),
      onReadBook: vi.fn(),
      onImportFromCatalog: vi.fn(),
      importStatus: defaultImportStatus,
      setImportStatus: vi.fn(),
      userCitationFormat: 'apa' as 'apa' | 'mla',
    };
    render(<BookDetailView {...mockProps} />);
    expect(screen.getByText('Return to My Shelf')).toBeInTheDocument();
    expect(screen.getByText('Read Book')).toBeInTheDocument();
    expect(screen.getByText('Catalog Provider:')).toBeInTheDocument();
    expect(screen.getByText('My Local Library')).toBeInTheDocument();
    expect(screen.getByText('Distributor:')).toBeInTheDocument();
    expect(screen.getByText('OAPEN')).toBeInTheDocument();
  });

  test('disables reading for metadata-only synced protected titles', () => {
    const mockProps = {
      book: {
        ...libraryBook,
        contentExcludedFromSync: true,
        requiresReauthorization: true,
        restoredFromSync: true,
        providerName: 'My Local Library',
      },
      source: 'library' as const,
      onBack: vi.fn(),
      onReadBook: vi.fn(),
      onImportFromCatalog: vi.fn(),
      importStatus: defaultImportStatus,
      setImportStatus: vi.fn(),
      userCitationFormat: 'apa' as 'apa' | 'mla',
    };

    render(<BookDetailView {...mockProps} />);

    const button = screen.getByRole('button', { name: /Reauthorize Access Required/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/Sign in to My Local Library in Catalog or Loans, then restore access on this device\./i),
    ).toBeInTheDocument();
  });

  test('keeps reading enabled for protected local copies that were imported on this device', () => {
    const mockProps = {
      book: {
        ...libraryBook,
        contentExcludedFromSync: true,
        requiresReauthorization: false,
        restoredFromSync: false,
      },
      source: 'library' as const,
      onBack: vi.fn(),
      onReadBook: vi.fn(),
      onImportFromCatalog: vi.fn(),
      importStatus: defaultImportStatus,
      setImportStatus: vi.fn(),
      userCitationFormat: 'apa' as 'apa' | 'mla',
    };

    render(<BookDetailView {...mockProps} />);

    const button = screen.getByRole('button', { name: /Read Book/i });
    expect(button).toBeEnabled();
    expect(screen.queryByText(/Reauthorize Access Required/i)).not.toBeInTheDocument();
  });
});
