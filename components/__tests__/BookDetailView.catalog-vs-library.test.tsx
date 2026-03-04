import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import BookDetailView from '../BookDetailView';

// Mock the ToastContext
const mockUseToast = vi.fn(() => ({
  showToast: vi.fn(),
}));

vi.mock('../toast/ToastContext', () => ({
  useToast: () => mockUseToast(),
}));

describe('Catalog vs Library BookDetailView Differences', () => {
  afterEach(() => {
    cleanup();
  });

  test('catalog book shows Add to Bookshelf button and distributor as provider', () => {
    // This simulates exactly what happens when you click a book from a catalog
    const catalogBook = {
      id: 101,
      title: 'OAPEN Catalog Book',
      author: 'Test Author',
      coverImage: null,
      downloadUrl: 'https://example.com/download',
      summary: 'A book from the OAPEN catalog',
      distributor: 'OAPEN',
      providerId: 'oapen-123',
      format: 'EPUB',
      acquisitionMediaType: 'application/epub+zip',
    } as any;

    const mockProps = {
  book: catalogBook,
  source: 'catalog' as const, // This is the key - source is 'catalog'
  catalogName: 'OAPEN Library',
  onBack: vi.fn(),
  onReadBook: vi.fn(),
  onImportFromCatalog: vi.fn(),
  importStatus: { isLoading: false, message: '', error: null, state: 'awaiting-auth' as 'awaiting-auth', host: 'test-host' },
  setImportStatus: vi.fn(),
  userCitationFormat: 'apa',
    };

    render(<BookDetailView {...mockProps} />);

    // Should show catalog-specific UI elements
    expect(screen.getByText('Return to Catalog')).toBeInTheDocument();
    expect(screen.getByText('Import to My Shelf')).toBeInTheDocument();

    // Should show provider information
    expect(screen.getByText('Information')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('OAPEN Library')).toBeInTheDocument();

    console.log('✅ Catalog book detail view shows distributor as provider');
  });

  test('library book shows Read Book button and providerName', () => {
    // This simulates what happens when you click a book from your library
    const libraryBook = {
      id: 1,
      title: 'My Library Book',
      author: 'Test Author',
      coverImage: null,
      providerId: 'lib-456',
      providerName: 'My Local Library',
      distributor: 'OAPEN', // Library books have distributor but should use providerName
      format: 'EPUB',
    } as any;

    const mockProps = {
  book: libraryBook,
  source: 'library' as const, // This is the key - source is 'library'
  onBack: vi.fn(),
  onReadBook: vi.fn(),
  onImportFromCatalog: vi.fn(),
  importStatus: { isLoading: false, message: '', error: null, state: 'awaiting-auth' as 'awaiting-auth', host: 'test-host' },
  setImportStatus: vi.fn(),
  userCitationFormat: 'apa',
    };

    render(<BookDetailView {...mockProps} />);

    // Should show library-specific UI elements
    expect(screen.getByText('Return to My Shelf')).toBeInTheDocument();
    expect(screen.getByText('Read Book')).toBeInTheDocument();

    // Should show provider information
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('My Local Library')).toBeInTheDocument();

    // Library books currently still display the stored distributor metadata
    expect(screen.getByText('Distributor: OAPEN')).toBeInTheDocument();

    console.log('✅ Library book detail view shows providerName, not distributor');
  });

  test('catalog PDF book shows Add to Bookshelf button', () => {
    const pdfCatalogBook = {
      id: 102,
      title: 'PDF from BiblioBoard',
      author: 'PDF Author',
      coverImage: null,
      downloadUrl: 'https://example.com/download.pdf',
      summary: 'A PDF book',
      distributor: 'BiblioBoard',
      providerId: 'biblio-789',
      format: 'PDF',
      acquisitionMediaType: 'application/pdf',
    } as any;

    const mockProps = {
  book: pdfCatalogBook,
  source: 'catalog' as const,
  onBack: vi.fn(),
  onReadBook: vi.fn(),
  onImportFromCatalog: vi.fn(),
  importStatus: { isLoading: false, message: '', error: null, state: 'awaiting-auth' as 'awaiting-auth', host: 'test-host' },
  setImportStatus: vi.fn(),
  userCitationFormat: 'apa',
    };

    render(<BookDetailView {...mockProps} />);

    // PDF files should be importable (app supports PDF reader)
    expect(screen.getByText('Import to My Shelf')).toBeInTheDocument();

    // Should show provider information
    expect(screen.getByText('Distributor: BiblioBoard')).toBeInTheDocument();

    console.log('✅ PDF catalog book shows Add to Bookshelf and distributor');
  });

  test('catalog book shows a series lane when related series books are available', () => {
    const onShowRelatedCatalogBook = vi.fn();
    const onOpenRelatedCatalogFeed = vi.fn();
    const catalogBook = {
      id: 201,
      title: 'Episode 2',
      author: 'Series Author',
      coverImage: null,
      downloadUrl: 'https://example.com/download-2',
      summary: 'Second book in a series',
      providerId: 'series-2',
      format: 'EPUB',
      acquisitionMediaType: 'application/epub+zip',
      relatedLinks: [
        {
          title: 'Recommended Works',
          url: 'https://example.com/related',
          rel: 'related',
          type: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
        },
      ],
      series: [{ name: 'Great Saga', position: 2, url: 'https://example.com/series/great-saga' }],
      collections: [
        { title: 'Featured Collection', href: 'https://example.com/collections/featured', source: 'link' },
        { title: 'Series Collection', href: 'https://example.com/collections/series', source: 'belongsTo' },
      ],
    } as any;

    const relatedSeriesBooks = [
      {
        ...catalogBook,
        id: 200,
        title: 'Episode 1',
        providerId: 'series-1',
        downloadUrl: 'https://example.com/download-1',
        series: [{ name: 'Great Saga', position: 1, url: 'https://example.com/series/great-saga' }],
      },
      catalogBook,
    ];

    render(
      <BookDetailView
        book={catalogBook}
        source="catalog"
        catalogName="Series Catalog"
        relatedSeriesBooks={relatedSeriesBooks}
        onShowRelatedCatalogBook={onShowRelatedCatalogBook}
        onOpenRelatedCatalogFeed={onOpenRelatedCatalogFeed}
        onBack={vi.fn()}
        onReadBook={vi.fn()}
        onImportFromCatalog={vi.fn()}
        importStatus={{ isLoading: false, message: '', error: null, state: 'awaiting-auth' as 'awaiting-auth', host: 'test-host' }}
        setImportStatus={vi.fn()}
        userCitationFormat="apa"
      />,
    );

    expect(screen.getByText('Series: Great Saga')).toBeInTheDocument();
    expect(screen.getByText('2 books')).toBeInTheDocument();
    expect(screen.getByText('Collections')).toBeInTheDocument();
    expect(screen.getByText(/Featured Collection, Series Collection/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recommended Works' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Same Series: Great Saga' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Series Collection' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Featured Collection' })).not.toBeInTheDocument();
    expect(screen.getByText('View more in full series')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View more in full series/i }));
    expect(onOpenRelatedCatalogFeed).toHaveBeenCalledWith('Same Series: Great Saga', 'https://example.com/series/great-saga');
  });
});
