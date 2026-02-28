import { describe, expect, it } from 'vitest';

import { buildOpenSearchUrl, parseOpenSearchDescription } from '../opensearch';

describe('OpenSearch utilities', () => {
  it('parses description documents and prefers OPDS Atom templates', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Catalog Search</ShortName>
  <Description>Search the catalog</Description>
  <Tags>books library</Tags>
  <Url
    type="application/json"
    template="/search.json{?searchTerms,count?}"
  />
  <Url
    type="application/atom+xml;profile=opds-catalog"
    template="/opds/search{?searchTerms,count?,startIndex?}"
  />
</OpenSearchDescription>`;

    const result = parseOpenSearchDescription(xml, 'https://example.org/catalog/');

    expect(result.shortName).toBe('Catalog Search');
    expect(result.description).toBe('Search the catalog');
    expect(result.tags).toEqual(['books', 'library']);
    expect(result.urls).toHaveLength(2);
    expect(result.activeTemplate).toEqual(
      expect.objectContaining({
        type: 'application/atom+xml;profile=opds-catalog',
        template: 'https://example.org/opds/search{?searchTerms,count?,startIndex?}',
        method: 'GET',
      }),
    );
    expect(result.activeTemplate?.params).toEqual([
      { name: 'searchTerms', required: true, namespace: undefined },
      { name: 'count', required: false, namespace: undefined },
      { name: 'startIndex', required: false, namespace: undefined },
    ]);
  });

  it('builds URLs from grouped query expressions and drops missing optional params', () => {
    const url = buildOpenSearchUrl(
      'https://example.org/opds/search{?searchTerms,count?,startIndex?}',
      {
        searchTerms: 'science fiction',
        startIndex: 11,
      },
    );

    expect(url).toBe('https://example.org/opds/search?searchTerms=science%20fiction&startIndex=11');
  });

  it('supports namespaced optional parameters in query expressions', () => {
    const url = buildOpenSearchUrl(
      'https://example.org/opds/search{?searchTerms,geo:box?}',
      {
        searchTerms: 'maps',
        'geo:box': '1,2,3,4',
      },
    );

    expect(url).toBe('https://example.org/opds/search?searchTerms=maps&geo:box=1%2C2%2C3%2C4');
  });

  it('throws when a required template parameter is missing', () => {
    expect(() => buildOpenSearchUrl(
      'https://example.org/opds/search{?searchTerms,count}',
      {
        searchTerms: 'history',
      },
    )).toThrow('Missing required OpenSearch parameter: count');
  });

  it('rejects invalid OpenSearch description documents', () => {
    expect(() => parseOpenSearchDescription(
      '<feed><title>Not OpenSearch</title></feed>',
      'https://example.org/',
    )).toThrow('Invalid OpenSearch description document.');
  });
});
