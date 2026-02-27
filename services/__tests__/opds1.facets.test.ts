import { describe, expect, it } from 'vitest';

import { parseOpds1Xml } from '../opds';

describe('parseOpds1Xml - facets', () => {
  it('parses feed-level OPDS facet links into grouped facets', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom"
            xmlns:opds="http://opds-spec.org/2010/catalog"
            xmlns:thr="http://purl.org/syndication/thread/1.0">
        <title>Sample Feed</title>
        <link rel="http://opds-spec.org/facet"
              href="/feed?availability=available"
              title="Available now"
              opds:facetGroup="Availability"
              opds:activeFacet="true"
              thr:count="12" />
        <link rel="http://opds-spec.org/facet"
              href="/feed"
              title="All titles"
              opds:facetGroup="Availability"
              thr:count="42" />
        <entry>
          <title>Book One</title>
          <author><name>Author</name></author>
          <link rel="http://opds-spec.org/acquisition/open-access" href="/books/1.epub" type="application/epub+zip" />
        </entry>
      </feed>`;

    const parsed = parseOpds1Xml(xml, 'https://example.org/catalog');
    expect(parsed.facetGroups).toHaveLength(1);
    expect(parsed.facetGroups[0].title).toBe('Availability');
    expect(parsed.facetGroups[0].links).toHaveLength(2);
    expect(parsed.facetGroups[0].links[0].isActive).toBe(true);
    expect(parsed.facetGroups[0].links[0].count).toBe(12);
  });
});
