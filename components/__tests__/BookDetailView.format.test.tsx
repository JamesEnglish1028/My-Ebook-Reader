
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
  expect(screen.getByRole('button', { name: /Import to My Shelf/i })).toBeInTheDocument();
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

  // Import button should show 'Import to My Shelf'
  expect(screen.getByRole('button', { name: /Import to My Shelf/i })).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: /Import to My Shelf/i })).toBeInTheDocument();
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

  it('disables catalog import for LCP-protected titles', () => {
    const book: CatalogBook = {
      title: 'Locked EPUB Book',
      author: 'Catalog Author',
      coverImage: null,
      downloadUrl: 'https://example.org/p/book.lcp',
      summary: 'An LCP-protected EPUB book',
      providerId: 'p4',
      format: 'EPUB',
      acquisitionMediaType: 'application/vnd.readium.lcp.license.v1.0+json',
      isLcpProtected: true,
    };

    render(<BookDetailView {...baseProps} book={book} source="catalog" onImportFromCatalog={async () => ({ success: false })} />);

    const button = screen.getByRole('button', { name: /Download for Thorium/i });
    expect(button).toBeEnabled();
    expect(
      screen.getByText(/This title cannot be read in MeBooks. Download the LCP file and open it in Thorium Reader\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Get Thorium Reader/i })).toBeInTheDocument();
  });

  it('disables catalog import for Adobe DRM titles', () => {
    const book: CatalogBook = {
      title: 'Adobe Locked EPUB Book',
      author: 'Catalog Author',
      coverImage: null,
      downloadUrl: 'https://example.org/p/book.acsm',
      summary: 'An Adobe DRM-protected EPUB book',
      providerId: 'p5',
      format: 'EPUB',
      acquisitionMediaType: 'application/adobe+epub',
      isAdobeDrmProtected: true,
    };

    render(<BookDetailView {...baseProps} book={book} source="catalog" onImportFromCatalog={async () => ({ success: false })} />);

    const button = screen.getByRole('button', { name: /Cannot Import: Adobe DRM/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/This title is protected with Adobe DRM and cannot be imported by this application\./i),
    ).toBeInTheDocument();
  });

  it('offers Borrow for Palace for Palace-hosted LCP titles', () => {
    const book: CatalogBook = {
      title: 'Palace Locked EPUB',
      author: 'Catalog Author',
      coverImage: null,
      downloadUrl: 'https://minotaur.dev.palaceproject.io/minotaur-test-library/works/1/fulfill/1',
      summary: 'A Palace LCP-protected EPUB book',
      providerId: 'p6',
      format: 'EPUB',
      acquisitionMediaType: 'application/vnd.readium.lcp.license.v1.0+json',
      isLcpProtected: true,
    };

    render(
      <BookDetailView
        {...baseProps}
        book={book}
        source="catalog"
        onImportFromCatalog={async () => ({ success: false })}
        onBorrowForPalace={async () => ({ success: true, action: 'palace-borrow' })}
      />,
    );

    expect(screen.getByRole('button', { name: /Borrow for Palace/i })).toBeEnabled();
    expect(screen.getByRole('link', { name: /Get Palace App/i })).toBeInTheDocument();
    expect(
      screen.getByText(/This protected title will be borrowed to your Palace account\. Read it in the Palace app after borrowing\./i),
    ).toBeInTheDocument();
  });

  it('offers Borrow for Palace for Palace-hosted Adobe DRM titles', () => {
    const book: CatalogBook = {
      title: 'Palace Adobe EPUB',
      author: 'Catalog Author',
      coverImage: null,
      downloadUrl: 'https://minotaur.dev.palaceproject.io/minotaur-test-library/works/2/fulfill/2',
      summary: 'A Palace Adobe-protected EPUB book',
      providerId: 'p7',
      format: 'EPUB',
      acquisitionMediaType: 'application/adobe+epub',
      isAdobeDrmProtected: true,
    };

    render(
      <BookDetailView
        {...baseProps}
        book={book}
        source="catalog"
        onImportFromCatalog={async () => ({ success: false })}
        onBorrowForPalace={async () => ({ success: true, action: 'palace-borrow' })}
      />,
    );

    expect(screen.getByRole('button', { name: /Borrow for Palace/i })).toBeEnabled();
    expect(screen.getByRole('link', { name: /Get Palace App/i })).toBeInTheDocument();
  });
});
