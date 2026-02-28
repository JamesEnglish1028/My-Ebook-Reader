import { describe, expect, it } from 'vitest';

import { filterBooksByPublication, getAvailablePublicationTypes } from '../opds';

describe('Catalog publication type filtering', () => {
  const books = [
    {
      title: 'Standard Book',
      author: 'Author 1',
      coverImage: null,
      downloadUrl: 'https://example.com/book.epub',
      summary: null,
      format: 'EPUB',
      schemaOrgType: 'https://schema.org/Book',
      publicationTypeLabel: 'Book',
    },
    {
      title: 'Audio Title',
      author: 'Author 2',
      coverImage: null,
      downloadUrl: 'https://example.com/book.audiobook',
      summary: null,
      format: 'AUDIOBOOK',
      schemaOrgType: 'https://schema.org/Audiobook',
      publicationTypeLabel: 'Audiobook',
    },
    {
      title: 'Gallery Image',
      author: 'Author 3',
      coverImage: null,
      downloadUrl: 'https://example.com/image.jpg',
      summary: null,
      schemaOrgType: 'https://schema.org/ImageObject',
      publicationTypeLabel: 'Image Object',
    },
  ];

  it('collects distinct publication type options from schema metadata', () => {
    expect(getAvailablePublicationTypes(books as any)).toEqual([
      { key: 'book', label: 'Book' },
      { key: 'audiobook', label: 'Audiobook' },
      { key: 'image-object', label: 'Image Object' },
    ]);
  });

  it('filters books by the normalized publication type key', () => {
    expect(filterBooksByPublication(books as any, 'book').map((book) => book.title)).toEqual(['Standard Book']);
    expect(filterBooksByPublication(books as any, 'audiobook').map((book) => book.title)).toEqual(['Audio Title']);
    expect(filterBooksByPublication(books as any, 'image-object').map((book) => book.title)).toEqual(['Gallery Image']);
  });
});
