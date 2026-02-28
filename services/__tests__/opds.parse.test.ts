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
});
