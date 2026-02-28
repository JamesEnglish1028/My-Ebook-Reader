import { describe, expect, it } from 'vitest';

import { getFormatFromMimeType, parseOpds1Xml } from '../opds';

describe('opds.ts - error handling and edge cases', () => {
  it('throws on invalid XML', () => {
    const badXml = '<feed><entry><title>Missing end';
    expect(() => parseOpds1Xml(badXml, 'https://example.com/')).toThrow();
  });

  it('throws on missing <feed> root', () => {
    const xml = '<notfeed></notfeed>';
    expect(() => parseOpds1Xml(xml, 'https://example.com/')).toThrow(/root <feed>/);
  });

  it('throws on empty Atom feed (no entries)', () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>`;
    expect(() => parseOpds1Xml(xml, 'https://example.com/')).toThrow(/contains no entries/);
  });

  it('throws on Atom feed with entries but no OPDS content', () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Just a title</title></entry></feed>`;
    expect(() => parseOpds1Xml(xml, 'https://example.com/')).toThrow(/no recognizable OPDS/);
  });

  it('parses pagination links', () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <link rel="next" href="/next"/>
      <link rel="previous" href="/prev"/>
      <link rel="first" href="/first"/>
      <link rel="last" href="/last"/>
      <opensearch:totalResults xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">42</opensearch:totalResults>
      <opensearch:itemsPerPage xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">10</opensearch:itemsPerPage>
      <opensearch:startIndex xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">1</opensearch:startIndex>
      <entry><title>Book</title><link rel="http://opds-spec.org/acquisition" href="/book.epub" type="application/epub+zip"/></entry>
    </feed>`;
    const { pagination } = parseOpds1Xml(xml, 'https://example.com/');
    expect(pagination.next).toContain('/next');
    expect(pagination.prev).toContain('/prev');
    expect(pagination.first).toContain('/first');
    expect(pagination.last).toContain('/last');
    expect(pagination.totalResults).toBe(42);
    expect(pagination.itemsPerPage).toBe(10);
    expect(pagination.startIndex).toBe(1);
  });

  it('getFormatFromMimeType returns undefined for atom+xml', () => {
    expect(getFormatFromMimeType('application/atom+xml;type=entry;profile=opds-catalog')).toBeUndefined();
  });
});
