import { describe, expect, it } from 'vitest';

import { buildCatalogImportMeta } from '../importMetadata';

describe('buildCatalogImportMeta', () => {
  it('marks protected audiobooks as metadata-only and requiring reauthorization', () => {
    const meta = buildCatalogImportMeta({
      title: 'Loaned Audiobook',
      author: 'Author',
      coverImage: null,
      downloadUrl: 'https://example.org/loan/fulfill',
      summary: null,
      format: 'AUDIOBOOK',
      isOpenAccess: false,
    });

    expect(meta.contentExcludedFromSync).toBe(true);
    expect(meta.requiresReauthorization).toBe(true);
  });

  it('does not mark open-access audiobooks for reauthorization', () => {
    const meta = buildCatalogImportMeta({
      title: 'Open Audiobook',
      author: 'Author',
      coverImage: null,
      downloadUrl: 'https://example.org/open/manifest.json',
      summary: null,
      format: 'AUDIOBOOK',
      isOpenAccess: true,
    });

    expect(meta.contentExcludedFromSync).toBeUndefined();
    expect(meta.requiresReauthorization).toBeUndefined();
  });
});
