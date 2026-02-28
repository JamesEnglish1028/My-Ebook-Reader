
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '@testing-library/jest-dom';
import type { CatalogBook } from '../../types';
import BookDetailView from '../BookDetailView';

const baseProps = {
  onBack: () => { },
  onReadBook: () => { },
  importStatus: { isLoading: false, message: '', error: null },
  setImportStatus: () => { },
} as any;

describe('BookDetailView format badge and import button', () => {
  it('displays PDF badge and enabled Add to Bookshelf button for PDF catalog book', () => {
    const book: CatalogBook = {
      title: 'PDF Book',
      author: 'PDF Author',
      coverImage: null,
      downloadUrl: 'https://example.org/p/book.pdf',
      summary: 'A PDF book',
      providerId: 'p1',
      format: 'PDF',
    };

    render(<BookDetailView {...baseProps} book={book} source="catalog" onImportFromCatalog={async () => ({ success: false })} />);

    // Format badge should display PDF
    expect(screen.getByText('PDF')).toBeInTheDocument();

  // Import button should allow PDF imports (app supports PDF reader)
  expect(screen.getByRole('button', { name: /Import to My Library/i })).toBeInTheDocument();
  });

  it('shows Add to Bookshelf for EPUB catalog book', () => {
    const book: CatalogBook = {
      title: 'EPUB Book',
      author: 'EPUB Author',
      coverImage: null,
      downloadUrl: 'https://example.org/p/book.epub',
      summary: 'An EPUB book',
      providerId: 'p2',
      format: 'EPUB',
    };

    render(<BookDetailView {...baseProps} book={book} source="catalog" onImportFromCatalog={async () => ({ success: false })} />);

    // Format badge should display EPUB
    expect(screen.getByText('EPUB')).toBeInTheDocument();

  // Import button should show 'Import to My Library'
  expect(screen.getByRole('button', { name: /Import to My Library/i })).toBeInTheDocument();
  });

  it('does not warn when acquisitionMediaType is present even if mediaType is missing', () => {
    const book: CatalogBook = {
      title: 'Derived EPUB Book',
      author: 'Catalog Author',
      coverImage: null,
      downloadUrl: 'https://example.org/p/book.epub',
      summary: 'An EPUB book',
      providerId: 'p3',
      format: 'EPUB',
      acquisitionMediaType: 'application/epub+zip',
    };

    render(<BookDetailView {...baseProps} book={book} source="catalog" onImportFromCatalog={async () => ({ success: false })} />);

    expect(screen.getByRole('button', { name: /Import to My Library/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/Warning: This item may not be a valid book file/i),
    ).not.toBeInTheDocument();
  });

  it('does not warn for imported library books when format is EPUB and mediaType fields are absent', () => {
    const book = {
      id: 42,
      title: 'Imported EPUB Book',
      author: 'Library Author',
      coverImage: null,
      format: 'EPUB',
    } as any;

    render(<BookDetailView {...baseProps} book={book} source="library" />);

    expect(screen.getByText('EPUB')).toBeInTheDocument();
    expect(
      screen.queryByText(/Warning: This item may not be a valid book file/i),
    ).not.toBeInTheDocument();
  });
});
