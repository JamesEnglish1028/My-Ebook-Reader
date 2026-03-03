import { describe, expect, it } from 'vitest';

import { parseOpds1Xml } from '../opds';
import { parseOpds2Json } from '../opds2';

describe('related catalog link parsing', () => {
  it('captures OPDS1 related acquisition feeds from entry links', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Sample Feed</title>
        <entry>
          <title>Palace Example</title>
          <author><name>Example Author</name></author>
          <id>urn:uuid:test-related-opds1</id>
          <link
            rel="http://opds-spec.org/acquisition/borrow"
            type="application/epub+zip"
            href="/fulfill/test-book" />
          <link
            href="/works/test-book/related_books"
            rel="related"
            type="application/atom+xml;profile=opds-catalog;kind=acquisition"
            title="Recommended Works" />
        </entry>
      </feed>`;

    const { books } = parseOpds1Xml(xml, 'https://catalog.example.org/feed.xml');
    expect(books).toHaveLength(1);
    expect(books[0].relatedLinks).toEqual([
      {
        title: 'Recommended Works',
        url: 'https://catalog.example.org/works/test-book/related_books',
        rel: 'related',
        type: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
      },
    ]);
  });

  it('captures OPDS2 related acquisition feeds from publication links', () => {
    const feed = {
      metadata: { title: 'Sample Feed' },
      publications: [
        {
          metadata: {
            title: 'Palace Example',
            author: [{ name: 'Example Author' }],
            identifier: 'urn:uuid:test-related-opds2',
          },
          links: [
            {
              rel: 'http://opds-spec.org/acquisition/borrow',
              href: '/fulfill/test-book',
              type: 'application/epub+zip',
            },
            {
              rel: 'related',
              href: '/works/test-book/related_books',
              type: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
              title: 'Recommended Works',
            },
          ],
        },
      ],
    };

    const { books } = parseOpds2Json(feed, 'https://catalog.example.org/feed.json');
    expect(books).toHaveLength(1);
    expect(books[0].relatedLinks).toEqual([
      {
        title: 'Recommended Works',
        url: 'https://catalog.example.org/works/test-book/related_books',
        rel: 'related',
        type: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
      },
    ]);
  });

  it('filters crawlable machine-harvest related links', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Sample Feed</title>
        <entry>
          <title>Palace Example</title>
          <author><name>Example Author</name></author>
          <id>urn:uuid:test-related-crawlable</id>
          <link
            rel="http://opds-spec.org/acquisition/borrow"
            type="application/epub+zip"
            href="/fulfill/test-book" />
          <link
            href="/crawlable"
            rel="related"
            type="application/atom+xml;profile=opds-catalog;kind=acquisition"
            title="Crawlable Export" />
        </entry>
      </feed>`;

    const { books } = parseOpds1Xml(xml, 'https://catalog.example.org/feed.xml');
    expect(books).toHaveLength(1);
    expect(books[0].relatedLinks).toBeUndefined();
  });

  it('keeps OPDS1 entry collection links as metadata, not navigation', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Sample Feed</title>
        <entry>
          <title>Palace Example</title>
          <author><name>Example Author</name></author>
          <id>urn:uuid:test-entry-collection</id>
          <link
            rel="http://opds-spec.org/acquisition/borrow"
            type="application/epub+zip"
            href="/fulfill/test-book" />
          <link
            rel="collection"
            type="application/atom+xml;profile=opds-catalog;kind=acquisition"
            href="/groups/not-book-membership"
            title="Feed Collection Context" />
          <link
            href="/works/test-book/related_books"
            rel="related"
            type="application/atom+xml;profile=opds-catalog;kind=acquisition"
            title="Recommended Works" />
        </entry>
      </feed>`;

    const { books, navLinks } = parseOpds1Xml(xml, 'https://catalog.example.org/feed.xml');
    expect(books).toHaveLength(1);
    expect(books[0].collections).toEqual([
      {
        title: 'Feed Collection Context',
        href: 'https://catalog.example.org/groups/not-book-membership',
      },
    ]);
    expect(navLinks).toEqual([]);
    expect(books[0].relatedLinks).toEqual([
      {
        title: 'Recommended Works',
        url: 'https://catalog.example.org/works/test-book/related_books',
        rel: 'related',
        type: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
      },
    ]);
  });
});
