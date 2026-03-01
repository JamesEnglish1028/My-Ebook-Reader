import { describe, expect, it } from 'vitest';
import { parseOpds1Xml } from '../opds';
import { xmlContent } from './fixtures/opdsCollectionsFixtures';

describe('OPDS1 parseOpds1Xml', () => {
  it('should parse collection links from OPDS1 entries', () => {
    const result = parseOpds1Xml(xmlContent, 'https://example.com');
    expect(result.books).toHaveLength(3);
    expect(result.books[0].collections).toHaveLength(1);
    expect(result.books[0].collections![0].title).toBe('Fiction');
    expect(result.books[0].collections![0].href).toBe('https://example.com/collections/fiction');
    expect(result.books[1].collections).toHaveLength(2);
    expect(result.books[1].collections![0].title).toBe('Fiction');
    expect(result.books[1].collections![1].title).toBe('Bestsellers');
    expect(result.books[2].collections).toBeUndefined();
    expect(result.navLinks.map((link) => link.title)).toEqual(['Fiction', 'Bestsellers']);
  });

  it('deduplicates repeated OPDS1 entries by Atom id and merges collections', () => {
    const duplicateXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Duplicate Feed</title>
  <entry>
    <title>Shared Book</title>
    <id>urn:uuid:shared-book</id>
    <author><name>Author</name></author>
    <link rel="http://opds-spec.org/acquisition" href="/books/shared.epub" type="application/epub+zip"/>
    <link rel="collection" href="/collections/fiction" title="Fiction"/>
  </entry>
  <entry>
    <title>Shared Book</title>
    <id>urn:uuid:shared-book</id>
    <author><name>Author</name></author>
    <link rel="http://opds-spec.org/acquisition" href="/books/shared.epub" type="application/epub+zip"/>
    <link rel="collection" href="/collections/featured" title="Featured"/>
  </entry>
</feed>`;

    const result = parseOpds1Xml(duplicateXml, 'https://example.com');

    expect(result.books).toHaveLength(1);
    expect(result.books[0].providerId).toBe('urn:uuid:shared-book');
    expect(result.books[0].collections).toEqual([
      { title: 'Fiction', href: 'https://example.com/collections/fiction' },
      { title: 'Featured', href: 'https://example.com/collections/featured' },
    ]);
    expect(result.navLinks.map((link) => link.title)).toEqual(['Fiction', 'Featured']);
  });

  it('parses availability/distributor metadata and keeps distributor mirror collections out of navigation', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog" xmlns:bibframe="http://bibframe.org/vocab/">
  <title>Distributor Feed</title>
  <entry>
    <title>Provider Book</title>
    <id>urn:uuid:provider-book</id>
    <author><name>Author</name></author>
    <bibframe:distribution bibframe:ProviderName="OAPEN"/>
    <link rel="http://opds-spec.org/acquisition/borrow" href="/borrow/provider" type="application/atom+xml;type=entry;profile=opds-catalog">
      <opds:indirectAcquisition type="application/pdf" />
      <opds:availability status="unavailable" />
    </link>
    <link rel="collection" href="/collections/oapen" title="OAPEN"/>
    <link rel="collection" href="/collections/featured" title="Featured"/>
  </entry>
</feed>`;

    const result = parseOpds1Xml(xml, 'https://demo.palaceproject.io/catalog');

    expect(result.books).toHaveLength(1);
    expect(result.books[0].distributor).toBe('OAPEN');
    expect(result.books[0].availabilityStatus).toBe('unavailable');
    expect(result.books[0].collections).toEqual([
      { title: 'OAPEN', href: 'https://demo.palaceproject.io/collections/oapen' },
      { title: 'Featured', href: 'https://demo.palaceproject.io/collections/featured' },
    ]);
    expect(result.navLinks.map((link) => link.title)).toEqual(['Featured']);
  });

  it('treats entry links with MIME kind=navigation as OPDS1 navigation entries', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Navigation Feed</title>
  <entry>
    <title>All Journals (673)</title>
    <link type="application/atom+xml;profile=opds-catalog;kind=navigation" href="http://opds.openedition.org/?platform=OJ&amp;core=publishers"/>
    <id>http://opds.openedition.org/?platform=OJ&amp;core=publishers</id>
    <content>All Journals Catalog</content>
  </entry>
  <entry>
    <title>All books (16127)</title>
    <link type="application/atom+xml;profile=opds-catalog;kind=navigation" href="http://opds.openedition.org/?platform=OB&amp;core=publishers"/>
    <id>http://opds.openedition.org/?platform=OB&amp;core=publishers</id>
    <content>All books Catalog</content>
  </entry>
</feed>`;

    const result = parseOpds1Xml(xml, 'http://opds.openedition.org/');

    expect(result.books).toHaveLength(0);
    expect(result.navLinks).toEqual([
      {
        title: 'All Journals (673)',
        url: 'http://opds.openedition.org/?platform=OJ&core=publishers',
        rel: 'navigation',
        type: 'application/atom+xml;profile=opds-catalog;kind=navigation',
        source: 'navigation',
      },
      {
        title: 'All books (16127)',
        url: 'http://opds.openedition.org/?platform=OB&core=publishers',
        rel: 'navigation',
        type: 'application/atom+xml;profile=opds-catalog;kind=navigation',
        source: 'navigation',
      },
    ]);
  });

  it('treats entry links with MIME kind=acquisition as navigable catalog entries when no OPDS acquisition rel is present', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Acquisition Navigation Feed</title>
  <entry>
    <title>Anglophonia Caliban/Sigma (17)</title>
    <link type="application/atom+xml;profile=opds-catalog;kind=acquisition" href="http://opds.openedition.org/?platform=OJ&amp;core=documents&amp;siteName=acs"/>
    <id>https://journals.openedition.org/acs</id>
    <summary type="text">Journal catalog entry</summary>
  </entry>
</feed>`;

    const result = parseOpds1Xml(xml, 'http://opds.openedition.org/');

    expect(result.books).toHaveLength(0);
    expect(result.navLinks).toEqual([
      {
        title: 'Anglophonia Caliban/Sigma (17)',
        url: 'http://opds.openedition.org/?platform=OJ&core=documents&siteName=acs',
        rel: 'acquisition',
        type: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
        source: 'navigation',
      },
    ]);
  });

  it('falls back to thumbnail images and captures additional authors as contributors', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Author Feed</title>
  <entry>
    <title>Collaborative Book</title>
    <author><name>Primary Author</name></author>
    <author><name>Second Author</name></author>
    <author><name>Third Author</name></author>
    <link rel="http://opds-spec.org/acquisition" href="/books/collab.epub" type="application/epub+zip"/>
    <link rel="http://opds-spec.org/image/thumbnail" href="/covers/collab-thumb.png" type="image/png"/>
  </entry>
</feed>`;

    const result = parseOpds1Xml(xml, 'https://example.com/');

    expect(result.books).toHaveLength(1);
    expect(result.books[0].author).toBe('Primary Author');
    expect(result.books[0].contributors).toEqual(['Second Author', 'Third Author']);
    expect(result.books[0].coverImage).toBe('https://example.com/covers/collab-thumb.png');
  });

  it('recognizes non-standard thumbnail rels as cover images', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Thumbnail Feed</title>
  <entry>
    <title>Thumbnail Book</title>
    <author><name>Author</name></author>
    <link rel="http://opds-spec.org/acquisition" href="/books/thumb.epub" type="application/epub+zip"/>
    <link rel="thumbnail" href="/covers/thumb.jpg" type="image/jpeg"/>
  </entry>
</feed>`;

    const result = parseOpds1Xml(xml, 'https://example.com/');

    expect(result.books).toHaveLength(1);
    expect(result.books[0].coverImage).toBe('https://example.com/covers/thumb.jpg');
  });

  it('captures OpenSearch description links as catalog search metadata', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Searchable Feed</title>
  <link rel="search" href="/search{?query}" type="application/opensearchdescription+xml" title="Search catalog"/>
  <entry>
    <title>Book</title>
    <link rel="http://opds-spec.org/acquisition" href="/books/book.epub" type="application/epub+zip"/>
  </entry>
</feed>`;

    const result = parseOpds1Xml(xml, 'https://example.com/');

    expect(result.search).toEqual({
      kind: 'opensearch',
      descriptionUrl: 'https://example.com/search%7B?query}',
      type: 'application/opensearchdescription+xml',
      title: 'Search catalog',
      rel: 'search',
    });
    expect(result.navLinks).not.toContainEqual(
      expect.objectContaining({
        rel: 'search',
      }),
    );
  });

  it('promotes feed-level start and up links as navigation options', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Nested Feed</title>
  <link rel="start" href="/catalog" type="application/atom+xml;profile=opds-catalog" />
  <link rel="up" href="/catalog/parent" type="application/atom+xml;profile=opds-catalog" title="Back to Parent" />
</feed>`;

    const result = parseOpds1Xml(xml, 'https://example.com/section/');

    expect(result.navLinks).toContainEqual({
      title: 'Home',
      url: 'https://example.com/catalog',
      rel: 'start',
      type: 'application/atom+xml;profile=opds-catalog',
      source: 'navigation',
    });
    expect(result.navLinks).toContainEqual({
      title: 'Back to Parent',
      url: 'https://example.com/catalog/parent',
      rel: 'up',
      type: 'application/atom+xml;profile=opds-catalog',
      source: 'navigation',
    });
  });
});
