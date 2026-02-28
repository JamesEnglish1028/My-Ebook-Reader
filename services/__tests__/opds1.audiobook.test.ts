import { describe, it, expect } from 'vitest';

import { parseOpds1Xml, getAvailableMediaModes, filterBooksByMedia, getFormatFromMimeType } from '../opds';

describe('OPDS 1 Audiobook Detection', () => {
  it('correctly detects audiobooks from schema:additionalType attribute', () => {
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:schema="http://schema.org/">
  <entry schema:additionalType="http://bib.schema.org/Audiobook">
    <title>Sample Audiobook</title>
    <author><name>Test Author</name></author>
    <link rel="http://opds-spec.org/acquisition" href="https://example.com/book.m4a" type="audio/mp4"/>
  </entry>
  <entry schema:additionalType="http://schema.org/EBook">
    <title>Sample E-book</title>
    <author><name>Test Author</name></author>
    <link rel="http://opds-spec.org/acquisition" href="https://example.com/book.epub" type="application/epub+zip"/>
  </entry>
  <entry>
    <title>Default Book</title>
    <author><name>Test Author</name></author>
    <link rel="http://opds-spec.org/acquisition" href="https://example.com/book2.epub" type="application/epub+zip"/>
  </entry>
</feed>`;

    const { books } = parseOpds1Xml(xmlData, 'https://example.com/');
    
    expect(books).toHaveLength(3);
    
    // Check audiobook
    const audiobook = books.find(b => b.title === 'Sample Audiobook');
    expect(audiobook).toBeDefined();
    expect(audiobook?.format).toBe('AUDIOBOOK');
    expect(audiobook?.acquisitionMediaType).toBe('http://bib.schema.org/Audiobook');
    
    // Check e-book
    const ebook = books.find(b => b.title === 'Sample E-book');
    expect(ebook).toBeDefined();
    expect(ebook?.format).toBe('EPUB');
    expect(ebook?.acquisitionMediaType).toBe('application/epub+zip');
    
    // Check default book
    const defaultBook = books.find(b => b.title === 'Default Book');
    expect(defaultBook).toBeDefined();
    expect(defaultBook?.format).toBe('EPUB');
    expect(defaultBook?.acquisitionMediaType).toBe('application/epub+zip');
  });

  it('correctly identifies available media modes including audiobooks', () => {
    const books = [
      {
        title: 'Audiobook 1',
        format: 'AUDIOBOOK',
        acquisitionMediaType: 'http://bib.schema.org/Audiobook',
        author: 'Author 1',
        downloadUrl: 'https://example.com/audio1',
        coverImage: null,
        summary: null,
      },
      {
        title: 'E-book 1',
        format: 'EPUB',
        acquisitionMediaType: 'application/epub+zip',
        author: 'Author 2',
        downloadUrl: 'https://example.com/ebook1',
        coverImage: null,
        summary: null,
      },
      {
        title: 'PDF Book',
        format: 'PDF',
        acquisitionMediaType: 'application/pdf',
        author: 'Author 3',
        downloadUrl: 'https://example.com/pdf1',
        coverImage: null,
        summary: null,
      },
    ];

    const mediaModes = getAvailableMediaModes(books);
    
    expect(mediaModes).toContain('all');
    expect(mediaModes).toContain('epub');
    expect(mediaModes).toContain('pdf');
    expect(mediaModes).toContain('audiobook');
    expect(mediaModes).toHaveLength(4);
  });

  it('correctly filters books by media type', () => {
    const books = [
      {
        title: 'Audiobook 1',
        format: 'AUDIOBOOK',
        acquisitionMediaType: 'http://bib.schema.org/Audiobook',
        author: 'Author 1',
        downloadUrl: 'https://example.com/audio1',
        coverImage: null,
        summary: null,
      },
      {
        title: 'E-book 1',
        format: 'EPUB',
        acquisitionMediaType: 'application/epub+zip',
        author: 'Author 2',
        downloadUrl: 'https://example.com/ebook1',
        coverImage: null,
        summary: null,
      },
      {
        title: 'PDF Book',
        format: 'PDF',
        acquisitionMediaType: 'application/pdf',
        author: 'Author 3',
        downloadUrl: 'https://example.com/pdf1',
        coverImage: null,
        summary: null,
      },
    ];

    // Test filtering by audiobook
    const audiobookFiltered = filterBooksByMedia(books, 'audiobook');
    expect(audiobookFiltered).toHaveLength(1);
    expect(audiobookFiltered[0].title).toBe('Audiobook 1');

    // Test filtering by epub
    const epubFiltered = filterBooksByMedia(books, 'epub');
    expect(epubFiltered).toHaveLength(1);
    expect(epubFiltered[0].title).toBe('E-book 1');

    // Test filtering by pdf
    const pdfFiltered = filterBooksByMedia(books, 'pdf');
    expect(pdfFiltered).toHaveLength(1);
    expect(pdfFiltered[0].title).toBe('PDF Book');

    // Test filtering by all
    const allFiltered = filterBooksByMedia(books, 'all');
    expect(allFiltered).toHaveLength(3);
  });

  it('correctly identifies audiobook mime types in getFormatFromMimeType', () => {
    expect(getFormatFromMimeType('http://bib.schema.org/Audiobook')).toBe('AUDIOBOOK');
    expect(getFormatFromMimeType('application/audiobook')).toBe('AUDIOBOOK');
    expect(getFormatFromMimeType('audio/mp4')).toBeUndefined(); // Regular audio mime types should not be identified as audiobooks
    expect(getFormatFromMimeType('application/epub+zip')).toBe('EPUB');
    expect(getFormatFromMimeType('application/pdf')).toBe('PDF');
  });

  it('handles edge cases in audiobook detection', () => {
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:schema="http://schema.org/">
  <entry schema:additionalType="http://schema.org/Audiobook">
    <title>Alternative Schema Audiobook</title>
    <author><name>Test Author</name></author>
    <link rel="http://opds-spec.org/acquisition" href="https://example.com/book.m4a" type="audio/mp4"/>
  </entry>
  <entry>
    <title>Book Without Schema</title>
    <author><name>Test Author</name></author>
    <link rel="http://opds-spec.org/acquisition" href="https://example.com/book.epub" type="application/epub+zip"/>
  </entry>
</feed>`;

    const { books } = parseOpds1Xml(xmlData, 'https://example.com/');
    
    expect(books).toHaveLength(2);
    
    // Check alternative audiobook schema
    const audiobook = books.find(b => b.title === 'Alternative Schema Audiobook');
    expect(audiobook).toBeDefined();
    expect(audiobook?.format).toBe('AUDIOBOOK');
    expect(audiobook?.acquisitionMediaType).toBe('http://bib.schema.org/Audiobook');
    
    // Check regular book
    const regularBook = books.find(b => b.title === 'Book Without Schema');
    expect(regularBook).toBeDefined();
    expect(regularBook?.format).toBe('EPUB');
    expect(regularBook?.acquisitionMediaType).toBe('application/epub+zip');
  });
});
