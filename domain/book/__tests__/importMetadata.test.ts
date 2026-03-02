import { describe, expect, it } from 'vitest';

import { buildCatalogImportMeta, normalizeStoredBookSyncState } from '../importMetadata';

describe('buildCatalogImportMeta', () => {
  it('marks protected audiobooks as metadata-only for sync without marking the live copy for reauthorization', () => {
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
    expect(meta.requiresReauthorization).toBeUndefined();
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

  it('clears stale reauthorization flags for protected local copies', () => {
    const normalized = normalizeStoredBookSyncState({
      id: 1,
      title: 'Local Loan Copy',
      author: 'Author',
      coverImage: null,
      epubData: new ArrayBuffer(8),
      format: 'EPUB',
      contentExcludedFromSync: true,
      requiresReauthorization: true,
      restoredFromSync: false,
    });

    expect(normalized?.requiresReauthorization).toBeUndefined();
  });

  it('restores reauthorization flags for synced placeholders when missing', () => {
    const normalized = normalizeStoredBookSyncState({
      id: 2,
      title: 'Synced Placeholder',
      author: 'Author',
      coverImage: null,
      epubData: new ArrayBuffer(8),
      format: 'PDF',
      contentExcludedFromSync: true,
      restoredFromSync: true,
    });

    expect(normalized?.requiresReauthorization).toBe(true);
  });
});
