import { describe, expect, it } from 'vitest';

import { getAvailableAudiences } from '../opds';
import { parseOpds2Json } from '../opds2';

describe('parseOpds2Json - navigation/catalog inference', () => {
  it('infers catalog navigation items when type is application/opds+json and rel is missing', () => {
    const json = {
      metadata: { title: 'Registry' },
      navigation: [
        { title: 'Example Catalog', href: '/catalog/example', type: 'application/opds+json' },
      ],
    };

    const { navLinks } = parseOpds2Json(json, 'https://example.org/');
    expect(navLinks).toHaveLength(1);
    expect(navLinks[0].title).toBe('Example Catalog');
    expect(navLinks[0].url).toContain('/catalog/example');
    expect(navLinks[0].isCatalog).toBeTruthy();
    expect(navLinks[0].rel).toBe('subsection');
  });

  it('normalizes non-string rel/subject values without inventing navigation links', () => {
    const json = {
      metadata: { title: 'Feed' },
      links: [
        { title: 'Fiction', href: '/groups/fiction', rel: { value: 'collection' } },
      ],
      publications: [
        {
          metadata: {
            title: 'Book A',
            author: 'Author A',
            subject: [{ name: 'Young Adult' }],
          },
          links: [
            { href: '/books/a.epub', rel: 'http://opds-spec.org/acquisition/open-access', type: 'application/epub+zip' },
          ],
        },
      ],
    };

    const { books, navLinks, facetGroups } = parseOpds2Json(json, 'https://example.org/');
    expect(navLinks).toHaveLength(0);
    expect(facetGroups).toHaveLength(0);
    expect(books).toHaveLength(1);
    expect(books[0].subjects).toEqual(['Young Adult']);
    expect(() => getAvailableAudiences(books)).not.toThrow();
  });

  it('parses OPDS 2 facets separately from navigation links', () => {
    const json = {
      metadata: { title: 'Feed' },
      navigation: [
        { title: 'Browse by Subject', href: '/navigation/subjects', rel: 'subsection', type: 'application/opds+json' },
      ],
      facets: [
        {
          metadata: { title: 'Availability' },
          links: [
            {
              title: 'Available now',
              href: '/feed?availability=available',
              rel: 'self',
              properties: { numberOfItems: 12 },
            },
            {
              title: 'All titles',
              href: '/feed',
              rel: 'collection',
              properties: { numberOfItems: 42 },
            },
          ],
        },
      ],
    };

    const { navLinks, facetGroups } = parseOpds2Json(json, 'https://example.org/');
    expect(navLinks).toHaveLength(1);
    expect(facetGroups).toHaveLength(1);
    expect(facetGroups[0].title).toBe('Availability');
    expect(facetGroups[0].links[0].title).toBe('Available now');
    expect(facetGroups[0].links[0].isActive).toBe(true);
    expect(facetGroups[0].links[0].count).toBe(12);
  });

  it('ignores non-OPDS alternate links inside navigation arrays', () => {
    const json = {
      metadata: { title: 'Arts & Humanities OERs' },
      navigation: [
        {
          rel: 'modules:cff5347e-e674-4229-8ae6-086a276291c1',
          href: 'https://catalog.openresearchlibrary.org/opds/v2/modules/cff5347e-e674-4229-8ae6-086a276291c1/0',
          type: 'application/opds+json',
          title: 'Arts & Humanities OERs',
        },
        {
          rel: 'alternate',
          href: 'https://openresearchlibrary.org/module/cff5347e-e674-4229-8ae6-086a276291c1',
          type: 'text/html',
          title: 'View on BiblioBoard',
        },
      ],
    };

    const { navLinks } = parseOpds2Json(json, 'https://catalog.openresearchlibrary.org/');
    expect(navLinks).toHaveLength(1);
    expect(navLinks[0].title).toBe('Arts & Humanities OERs');
    expect(navLinks[0].type).toBe('application/opds+json');
  });
});
