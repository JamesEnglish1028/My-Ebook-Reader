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

  it('normalizes non-string rel/subject values so catalog filtering does not crash', () => {
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

    const { books, navLinks } = parseOpds2Json(json, 'https://example.org/');
    expect(navLinks).toHaveLength(1);
    expect(navLinks[0].title).toBe('Fiction');
    expect(books).toHaveLength(1);
    expect(books[0].subjects).toEqual(['Young Adult']);
    expect(() => getAvailableAudiences(books)).not.toThrow();
  });
});
