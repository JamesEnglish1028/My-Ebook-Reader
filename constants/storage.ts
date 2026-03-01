/**
 * Storage Constants
 *
 * Centralized localStorage and storage-related keys used throughout the application.
 * This eliminates magic strings and makes it easier to:
 * - Understand what data is being stored
 * - Refactor storage keys safely
 * - Avoid typos in key names
 * - Maintain consistency across the app
 */

/**
 * Prefix for all ebook reader storage keys
 */
export const STORAGE_PREFIX = 'ebook-reader' as const;

/**
 * Library and catalog management keys
 */
export const LIBRARY_KEYS = {
    /** List of OPDS catalogs */
    CATALOGS: 'ebook-catalogs',
    /** List of catalog registries */
    REGISTRIES: 'ebook-reader-registries',
    /** User's preferred sort order for library books */
    SORT_ORDER: 'ebook-sort-order',
    /** Last sync timestamp with cloud storage */
    LAST_SYNC: 'ebook-reader-last-sync',
} as const;

/**
 * Reader settings and preferences keys
 */
export const READER_KEYS = {
    /** Global reader settings (fontSize, theme, fontFamily, etc.) */
    GLOBAL_SETTINGS: 'ebook-reader-settings-global',
    /** Prefix for per-book bookmarks */
    BOOKMARKS_PREFIX: 'ebook-reader-bookmarks',
    /** Prefix for per-book citations */
    CITATIONS_PREFIX: 'ebook-reader-citations',
    /** Prefix for per-book last reading position */
    POSITION_PREFIX: 'ebook-reader-pos',
    /** Prefix for per-book last spoken position (TTS) */
    SPOKEN_POSITION_PREFIX: 'ebook-reader-spoken-pos',
    /** Prefix for per-book PDF view state (zoom, fitMode) */
    PDF_VIEW_STATE_PREFIX: 'ebook-reader-pdf-view-state',
    /** Prefix for per-book EPUB view state (fontSize) */
    EPUB_VIEW_STATE_PREFIX: 'ebook-reader-epub-view-state',
} as const;

/**
 * App-wide UI preference keys
 */
export const UI_KEYS = {
    /** Global UI theme preference (system, light, dark) */
    THEME: 'ebook-reader-ui-theme',
} as const;

/**
 * OPDS and authentication keys
 */
export const OPDS_KEYS = {
    /** Stored OPDS credentials */
    CREDENTIALS: 'mebooks.opds.credentials',
    /** Legacy credentials (for migration) */
    LEGACY_CREDENTIALS: 'opds-credentials',
    /** ETag cache for OPDS feeds */
    ETAG_CACHE_PREFIX: 'mebooks.opds.etag',
} as const;

/**
 * Helper functions to generate per-book storage keys
 */
export const getStorageKey = {
    /** Get bookmarks key for a specific book */
    bookmarks: (bookId: number | string) =>
        `${READER_KEYS.BOOKMARKS_PREFIX}-${String(bookId)}`,

    /** Get citations key for a specific book */
    citations: (bookId: number | string) =>
        `${READER_KEYS.CITATIONS_PREFIX}-${String(bookId)}`,

    /** Get position key for a specific book */
    position: (bookId: number | string) =>
        `${READER_KEYS.POSITION_PREFIX}-${String(bookId)}`,

    /** Get spoken position key for a specific book */
    spokenPosition: (bookId: number | string) =>
        `${READER_KEYS.SPOKEN_POSITION_PREFIX}-${String(bookId)}`,

    /** Get PDF view state key for a specific book */
    pdfViewState: (bookId: number | string) =>
        `${READER_KEYS.PDF_VIEW_STATE_PREFIX}-${String(bookId)}`,

    /** Get EPUB view state key for a specific book */
    epubViewState: (bookId: number | string) =>
        `${READER_KEYS.EPUB_VIEW_STATE_PREFIX}-${String(bookId)}`,

    /** Get ETag cache key for a specific URL */
    etag: (url: string) =>
        `${OPDS_KEYS.ETAG_CACHE_PREFIX}-${url}`,
} as const;

/**
 * All storage keys in one place for easy reference and validation
 */
export const ALL_STORAGE_KEYS = {
    ...LIBRARY_KEYS,
    ...READER_KEYS,
    ...UI_KEYS,
    ...OPDS_KEYS,
} as const;
