import { describe, it, expect } from 'vitest';

import { parseOpds1Xml } from '../opds';
import { parseOpds2Json } from '../opds2';

describe('OPDS format selection', () => {
  it('OPDS1: prefers acquisition link mime over entry link mime', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Test</title>
      <entry>
        <title>Sample Book</title>
        <author><name>Author</name></author>
        <!-- entry-level link with atom mime (should NOT be treated as media type) -->
        <link rel="alternate" href="/entry/1" type="application/atom+xml;type=entry;profile=opds-catalog" />
        <!-- acquisition link with actual media type -->
        <link rel="http://opds-spec.org/acquisition/borrow" href="/borrow/1" type="application/epub+zip" />
      </entry>
    </feed>`;

    const { books } = parseOpds1Xml(xml, 'https://example.org/');
    expect(books.length).toBeGreaterThan(0);
    const b = books[0];
    // format should be EPUB (from acquisition link), not undefined or atom+xml
    expect(b.format).toBe('EPUB');
    expect(b.downloadUrl).toContain('/borrow/1');
  });

  it('OPDS2: prefers acquisition link mime over entry-level atom mime', () => {
    const json = {
      metadata: { title: 'Feed' },
      publications: [
        {
          metadata: { title: 'Sample Book', author: 'Author' },
          links: [
            { href: '/entry/2', rel: ['alternate'], type: 'application/atom+xml;type=entry;profile=opds-catalog' },
            { href: '/acq/2', rel: ['http://opds-spec.org/acquisition/borrow'], type: 'application/pdf' },
          ],
        },
      ],
    };

    const { books } = parseOpds2Json(json, 'https://example.org/');
    expect(books.length).toBeGreaterThan(0);
    const b = books[0];
    expect(b.format).toBe('PDF');
    expect(b.downloadUrl).toContain('/acq/2');
  });

  it('OPDS1: resolves indirectAcquisition chain to detect format', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
      <title>Test</title>
      <entry>
        <title>Indirect EPUB</title>
        <author><name>Author</name></author>
        <link rel="http://opds-spec.org/acquisition/borrow" href="/borrow/indirect">
          <opds:indirectAcquisition type="application/epub+zip" />
        </link>
      </entry>
    </feed>`;

    const { books } = parseOpds1Xml(xml, 'https://example.org/');
    expect(books.length).toBeGreaterThan(0);
    const b = books[0];
    expect(b.format).toBe('EPUB');
    expect(b.downloadUrl).toContain('/borrow/indirect');
  });

  it('OPDS1: resolves DRM wrapper chains to the underlying medium for badges', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
      <title>Test</title>
      <entry>
        <title>DRM EPUB</title>
        <author><name>Author</name></author>
        <link rel="http://opds-spec.org/acquisition/borrow" href="/borrow/drm-epub" type="application/atom+xml;type=entry;profile=opds-catalog">
          <opds:indirectAcquisition type="application/vnd.adobe.adept+xml">
            <opds:indirectAcquisition type="application/epub+zip" />
          </opds:indirectAcquisition>
        </link>
      </entry>
      <entry>
        <title>DRM PDF</title>
        <author><name>Author</name></author>
        <link rel="http://opds-spec.org/acquisition/borrow" href="/borrow/drm-pdf" type="application/atom+xml;type=entry;profile=opds-catalog">
          <opds:indirectAcquisition type="application/vnd.librarysimplified.bearer-token+json">
            <opds:indirectAcquisition type="application/pdf" />
          </opds:indirectAcquisition>
        </link>
      </entry>
    </feed>`;

    const { books } = parseOpds1Xml(xml, 'https://example.org/');
    expect(books).toHaveLength(2);
    expect(books[0].format).toBe('EPUB');
    expect(books[0].acquisitionMediaType).toBe('application/epub+zip');
    expect(books[1].format).toBe('PDF');
    expect(books[1].acquisitionMediaType).toBe('application/pdf');
  });
});
