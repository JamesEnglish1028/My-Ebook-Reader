import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LocalLibraryView from '../LocalLibraryView';

const useBooksMock = vi.fn();
const useDeleteBookMock = vi.fn();
const bookGridSpy = vi.fn();
const emptyStateSpy = vi.fn();

vi.mock('../../../../hooks', () => ({
  useBooks: () => useBooksMock(),
  useDeleteBook: () => useDeleteBookMock(),
}));

vi.mock('../../../shared', () => ({
  Error: () => null,
  Loading: () => null,
}));

vi.mock('../../shared', () => ({
  ExternalReaderBadge: (props: unknown) => {
    const { app } = props as { app?: 'palace' | 'thorium' };
    return <span>{app === 'palace' ? 'Palace' : app === 'thorium' ? 'Thorium' : null}</span>;
  },
  BookGrid: (props: unknown) => {
    bookGridSpy(props);
    const { books } = props as { books: Array<{ title: string }> };
    return (
      <div data-testid="book-grid">
        {books.map((book) => (
          <div key={book.title}>{book.title}</div>
        ))}
      </div>
    );
  },
  EmptyState: (props: unknown) => {
    emptyStateSpy(props);
    const { title, message } = props as { title?: string; message?: string };
    return (
      <div data-testid="empty-state">
        {title}
        {message}
      </div>
    );
  },
}));

vi.mock('../../../DeleteConfirmationModal', () => ({
  default: () => null,
}));

describe('LocalLibraryView filters and layouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeleteBookMock.mockReturnValue({ mutate: vi.fn() });
    useBooksMock.mockReturnValue({
      data: [
        { id: 1, title: 'Catalog EPUB', author: 'A', providerName: 'Palace', format: 'EPUB' },
        { id: 2, title: 'Catalog PDF', author: 'B', providerName: 'BiblioBoard', format: 'PDF', externalReaderApp: 'palace' },
        { id: 3, title: 'Manual Upload', author: 'C', format: 'EPUB', externalReaderApp: 'thorium' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('filters by format and provider, and supports inline grouped layout', () => {
    render(
      <LocalLibraryView
        libraryRefreshFlag={0}
        onOpenBook={vi.fn()}
        onShowBookDetail={vi.fn()}
        onFileChange={vi.fn()}
        importStatus={{ isLoading: false, message: '', error: null }}
      />,
    );

    expect(screen.getByText('Showing 3 of 3 books')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open filters/i }));
    expect(screen.getAllByRole('button', { name: 'All' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Local Upload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read in Palace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read in Thorium' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Read Here' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Read in Palace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Read in Thorium' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));

    expect(screen.getByText('Showing 1 of 3 books')).toBeInTheDocument();
    expect(bookGridSpy.mock.calls.at(-1)?.[0]).toMatchObject({
      books: [{ title: 'Catalog PDF' }],
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'All' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Local Upload' }));

    expect(screen.getByText('Showing 1 of 3 books')).toBeInTheDocument();
    expect(bookGridSpy.mock.calls.at(-1)?.[0]).toMatchObject({
      books: [{ title: 'Manual Upload' }],
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'All' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Read in Thorium' }));

    expect(screen.getByText('Showing 1 of 3 books')).toBeInTheDocument();
    expect(bookGridSpy.mock.calls.at(-1)?.[0]).toMatchObject({
      books: [{ title: 'Manual Upload' }],
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'All' })[2]);
    fireEvent.click(screen.getByRole('button', { name: /Inline layout/i }));

    expect(screen.getByText('Manual Upload')).toBeInTheDocument();
    expect(screen.getAllByText('Local Upload').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Palace').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Thorium').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Provider' }));

    expect(screen.getAllByText('Local Upload').length).toBeGreaterThan(1);
    expect(screen.getAllByText('1 title').length).toBeGreaterThan(0);
  });
});
