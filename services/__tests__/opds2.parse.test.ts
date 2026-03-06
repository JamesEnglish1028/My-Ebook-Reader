import { describe, it, expect } from 'vitest';

import { parseOpds2Json } from '../opds2';

describe('parseOpds2Json', () => {
  it('parses publications with string-embedded XML links', () => {
    const json = {
      publications: [
        {
          metadata: { title: 'XML Links Book', author: 'Author' },
          links: '<link href="/content/book.epub" rel="http://opds-spec.org/acquisition" type="application/epub+zip" />',
        },
      ],
    };

    const { books } = parseOpds2Json(json, 'https://example.com/catalog/');
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('XML Links Book');
    expect(books[0].downloadUrl).toContain('/content/book.epub');
    expect(books[0].format).toBe('EPUB');
  });

  it('handles nested indirectAcquisition and infers format', () => {
    const json = {
      publications: [
        {
          metadata: { title: 'Nested Indirect', author: 'A' },
          links: [
            { href: '/acq/1', rel: 'http://opds-spec.org/acquisition', type: 'application/vnd.some+json', indirectAcquisition: { type: 'application/epub+zip' } },
          ],
        },
      ],
    };

    const { books } = parseOpds2Json(json, 'https://example.com/');
    expect(books).toHaveLength(1);
    expect(books[0].format).toBe('EPUB');
  });

  it('falls back to content array when acquisitions missing', () => {
    const json = {
      publications: [
        {
          metadata: { title: 'Content Fallback', author: 'B' },
          content: [ { href: '/files/sample.pdf', type: 'application/pdf' } ],
        },
      ],
    };

    const { books } = parseOpds2Json(json, 'https://cdn.example.com/');
    expect(books).toHaveLength(1);
    expect(books[0].downloadUrl).toContain('/files/sample.pdf');
    expect(books[0].format).toBe('PDF');
  });

  it('parses a simple OPDS2 publication (happy path)', () => {
    const feed = {
      metadata: { title: 'Catalog' },
      publications: [
        {
          metadata: { title: 'Book One', author: 'Jane Reader', description: 'A test book', identifier: 'book-one' },
          links: [ { href: '/works/1', rel: 'http://opds-spec.org/acquisition/borrow', type: 'application/epub+zip' } ],
          images: [ { href: '/covers/1.jpg' } ],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://example.org/');
    expect(books.length).toBe(1);
    const b = books[0];
    expect(b.title).toBe('Book One');
    expect(b.author).toBe('Jane Reader');
    expect(b.providerId).toBe('book-one');
    expect(b.format).toBe('EPUB');
    expect(b.coverImage).toContain('/covers/1.jpg');
  });

  it('extracts series metadata when present', () => {
    const feed = {
      metadata: { title: 'Series Catalog' },
      publications: [
        {
          metadata: {
            title: 'Episode 2',
            author: 'J. Writer',
            identifier: 'ep-2',
            series: { name: 'Great Saga', position: 2 },
          },
          links: [ { href: '/works/2', rel: 'http://opds-spec.org/acquisition/open-access', type: 'application/epub+zip' } ],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://example.org/');
    expect(books[0].series?.[0]?.name).toBe('Great Saga');
    expect(books[0].series?.[0]?.position).toBe(2);
  });

  it('extracts multiple belongsTo series entries as an ordered array', () => {
    const feed = {
      metadata: { title: 'Series Catalog' },
      publications: [
        {
          metadata: {
            title: 'Episode 4',
            author: 'J. Writer',
            identifier: 'ep-4',
            belongsTo: {
              series: [
                { name: 'Great Saga', position: 4, url: 'https://example.org/series/great-saga' },
                { name: 'Spin-Off', ordinal: 1 },
              ],
            },
          },
          links: [ { href: '/works/4', rel: 'http://opds-spec.org/acquisition/open-access', type: 'application/epub+zip' } ],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://example.org/');
    expect(books[0].series).toEqual([
      { name: 'Great Saga', position: 4, volume: undefined, url: 'https://example.org/series/great-saga' },
      { name: 'Spin-Off', position: 1, volume: undefined, url: undefined },
    ]);
  });

  it('extracts belongsTo collection metadata and preserves linked collections', () => {
    const feed = {
      metadata: { title: 'Collection Catalog' },
      publications: [
        {
          metadata: {
            title: 'Collected Story',
            author: 'J. Writer',
            identifier: 'col-1',
            belongsTo: {
              collection: [
                'SciFi Classics',
                { name: 'Award Winners', url: 'https://example.org/collections/awards' },
                { name: 'Editor Picks', links: { href: '/collections/editor-picks' } },
              ],
            },
          },
          links: [
            { href: '/works/col-1', rel: 'http://opds-spec.org/acquisition/open-access', type: 'application/epub+zip' },
            { href: '/collections/featured', rel: 'collection', title: 'Featured Collection', type: 'application/opds+json' },
          ],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://example.org/');
    expect(books[0].collections).toEqual([
      { title: 'Featured Collection', href: 'https://example.org/collections/featured', source: 'link' },
      { title: 'SciFi Classics', href: '', source: 'belongsTo' },
      { title: 'Award Winners', href: 'https://example.org/collections/awards', source: 'belongsTo' },
      { title: 'Editor Picks', href: 'https://example.org/collections/editor-picks', source: 'belongsTo' },
    ]);
  });

  it('maps subject objects into subjects and categories', () => {
    const feed = {
      metadata: { title: 'Subj Catalog' },
      publications: [
        {
          metadata: {
            title: 'Taxonomy',
            author: 'Analyst',
            subject: [
              { name: 'Science Fiction', term: 'sci-fi', scheme: 'http://example.org/genres' },
              'Space Opera',
            ],
          },
          links: [ { href: '/works/3', rel: 'http://opds-spec.org/acquisition/open-access', type: 'application/epub+zip' } ],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://example.org/');
    expect(books[0].subjects).toEqual(['Science Fiction', 'Space Opera']);
    expect(books[0].categories?.[0].scheme).toBe('http://example.org/genres');
    expect(books[0].categories?.[0].term).toBe('sci-fi');
  });

  it('supports OPDS2 single-object subject metadata with scheme and code', () => {
    const feed = {
      metadata: { title: 'Single Subject Catalog' },
      publications: [
        {
          metadata: {
            title: 'Manga Example',
            author: 'Example Author',
            subject: {
              name: 'Manga: Shonen',
              sortAs: 'Shonen',
              scheme: 'https://ns.editeur.org/thema/',
              code: 'XAMG',
            },
          },
          links: [{ href: '/works/5', rel: 'http://opds-spec.org/acquisition/open-access', type: 'application/epub+zip' }],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://example.org/');
    expect(books[0].subjects).toEqual(['Manga: Shonen']);
    expect(books[0].categories?.[0].scheme).toBe('https://ns.editeur.org/thema/');
    expect(books[0].categories?.[0].term).toBe('XAMG');
    expect(books[0].categories?.[0].label).toBe('Manga: Shonen');
  });

  it('supports OPDS2 plural subjects arrays with scheme and code', () => {
    const feed = {
      metadata: { title: 'Plural Subjects Catalog' },
      publications: [
        {
          metadata: {
            title: 'Feminism Reader',
            author: 'Research Author',
            subjects: [
              {
                name: 'Women. Feminism',
                sortAs: 'Women. Feminism',
                scheme: 'http://id.loc.gov',
                code: 'HQ',
              },
              {
                name: 'Feminism',
                sortAs: 'Feminism',
                scheme: 'http://id.loc.gov/authorities/subjects',
              },
              {
                name: 'Feminism and feminist theory',
                sortAs: 'Feminism and feminist theory',
                scheme: 'https://ns.editeur.org/thema/',
                code: 'JBSF1',
              },
            ],
          },
          links: [{ href: '/works/6', rel: 'http://opds-spec.org/acquisition/open-access', type: 'application/epub+zip' }],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://example.org/');
    expect(books[0].subjects).toEqual([
      'Women. Feminism',
      'Feminism',
      'Feminism and feminist theory',
    ]);
    expect(books[0].categories?.map((category) => category.term)).toEqual(['HQ', 'Feminism', 'JBSF1']);
    expect(books[0].categories?.map((category) => category.scheme)).toEqual([
      'http://id.loc.gov',
      'http://id.loc.gov/authorities/subjects',
      'https://ns.editeur.org/thema/',
    ]);
  });

  it('captures contributors alongside primary author', () => {
    const feed = {
      metadata: { title: 'Contrib Catalog' },
      publications: [
        {
          metadata: {
            title: 'With Editors',
            author: 'Lead Author',
            contributor: [ { name: 'Editor One' }, 'Editor Two' ],
          },
          links: [ { href: '/works/4', rel: 'http://opds-spec.org/acquisition/open-access', type: 'application/epub+zip' } ],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://example.org/');
    expect(books[0].author).toBe('Lead Author');
    expect(books[0].contributors).toEqual(['Editor One', 'Editor Two']);
  });

  it('filters crawlable navigation links', () => {
    const feed = {
      navigation: [
        {
          title: 'Browse',
          href: '/browse',
          rel: 'subsection',
          type: 'application/opds+json',
        },
        {
          title: 'Crawlable Export',
          href: '/crawlable',
          rel: 'subsection',
          type: 'application/opds+json',
        },
      ],
    };

    const { navLinks } = parseOpds2Json(feed, 'https://example.org/');
    expect(navLinks).toHaveLength(1);
    expect(navLinks[0].title).toBe('Browse');
  });
});
