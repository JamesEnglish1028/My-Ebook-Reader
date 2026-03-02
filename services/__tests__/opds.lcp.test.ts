import { describe, expect, it } from 'vitest';

import { parseOpds1Xml } from '../opds';
import { parseOpds2Json } from '../opds2';

describe('LCP detection in catalog parsing', () => {
  it('marks OPDS1 LCP-licensed EPUB entries as non-importable', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Sample Feed</title>
        <entry>
          <title>Under the Andes. Illustrated</title>
          <author><name>Rex Stout</name></author>
          <id>urn:uuid:test-lcp-opds1</id>
          <link
            rel="http://opds-spec.org/acquisition/borrow"
            type="application/vnd.readium.lcp.license.v1.0+json"
            href="/fulfill/test-lcp">
            <indirectAcquisition type="application/epub+zip" />
          </link>
        </entry>
      </feed>`;

    const { books } = parseOpds1Xml(xml, 'https://catalog.example.org/feed.xml');
    expect(books).toHaveLength(1);
    expect(books[0].format).toBe('EPUB');
    expect(books[0].isLcpProtected).toBe(true);
  });

  it('marks OPDS2 LCP-licensed EPUB entries as non-importable', () => {
    const feed = {
      metadata: { title: 'Sample Feed' },
      publications: [
        {
          metadata: {
            title: 'Under the Andes. Illustrated',
            author: [{ name: 'Rex Stout' }],
            identifier: 'urn:uuid:test-lcp-opds2',
          },
          links: [
            {
              rel: 'http://opds-spec.org/acquisition/borrow',
              href: '/fulfill/test-lcp',
              type: 'application/vnd.readium.lcp.license.v1.0+json',
              properties: {
                indirectAcquisition: [
                  { type: 'application/epub+zip' },
                ],
              },
            },
          ],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://catalog.example.org/feed.json');
    expect(books).toHaveLength(1);
    expect(books[0].format).toBe('EPUB');
    expect(books[0].isLcpProtected).toBe(true);
  });

  it('marks OPDS1 Adobe DRM EPUB entries as non-importable', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Sample Feed</title>
        <entry>
          <title>Adobe Locked EPUB</title>
          <author><name>Adobe Author</name></author>
          <id>urn:uuid:test-adobe-opds1</id>
          <link
            rel="http://opds-spec.org/acquisition/borrow"
            type="application/adobe+epub"
            href="/fulfill/test-adobe" />
        </entry>
      </feed>`;

    const { books } = parseOpds1Xml(xml, 'https://catalog.example.org/feed.xml');
    expect(books).toHaveLength(1);
    expect(books[0].format).toBe('EPUB');
    expect(books[0].isAdobeDrmProtected).toBe(true);
  });

  it('marks OPDS2 Adobe DRM EPUB entries as non-importable', () => {
    const feed = {
      metadata: { title: 'Sample Feed' },
      publications: [
        {
          metadata: {
            title: 'Adobe Locked EPUB',
            author: [{ name: 'Adobe Author' }],
            identifier: 'urn:uuid:test-adobe-opds2',
          },
          links: [
            {
              rel: 'http://opds-spec.org/acquisition/borrow',
              href: '/fulfill/test-adobe',
              type: 'application/adobe+epub',
            },
          ],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://catalog.example.org/feed.json');
    expect(books).toHaveLength(1);
    expect(books[0].format).toBe('EPUB');
    expect(books[0].isAdobeDrmProtected).toBe(true);
  });
});
