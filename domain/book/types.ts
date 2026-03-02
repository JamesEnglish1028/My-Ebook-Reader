/**
 * Book Domain Types
 *
 * This module defines all types related to books in the user's library.
 * Books in this domain are "owned" - they exist in the user's collection.
 */

/**
 * Book format enumeration
 */
export type BookFormat = 'EPUB' | 'PDF' | string;

/**
 * Book metadata - represents a book in the user's library.
 * This is the "view" of a book without the binary data.
 */
export interface BookMetadata {
  id: number;
  title: string;
  author: string;
  coverImage: string | null; // Base64 encoded image
  sourceUrl?: string;
  manifestUrl?: string;
  fulfillmentUrl?: string;
  publisher?: string;
  publicationDate?: string;
  isbn?: string; // Kept for backwards compatibility
  providerId?: string; // ID from the originating catalog
  providerName?: string; // Name of the catalog/provider
  distributor?: string; // Distribution provider (e.g., OAPEN, BiblioBoard)
  description?: string;
  subjects?: string[];
  format?: BookFormat;

  // --- OPF/EPUB metadata extensions ---
  language?: string;
  rights?: string;
  identifiers?: string[];
  opfRaw?: string; // Raw OPF XML (optional, for debugging)

  // --- Accessibility metadata (from OPF) ---
  accessModes?: string[];
  accessModesSufficient?: string[];
  accessibilityFeatures?: string[];
  hazards?: string[];
  accessibilitySummary?: string;
  certificationConformsTo?: string[];
  certification?: string;

  // --- User-friendly accessibility feedback (mapped) ---
  accessibilityFeedback?: string;
}

/**
 * Complete book record including binary data.
 * Used for storage operations in IndexedDB.
 */
export interface BookRecord {
  id?: number; // Optional for new books not yet saved
  title: string;
  author: string;
  coverImage: string | null;
  epubData: ArrayBuffer; // The actual book content
  sourceUrl?: string;
  manifestUrl?: string;
  fulfillmentUrl?: string;
  publisher?: string;
  publicationDate?: string;
  isbn?: string;
  providerId?: string;
  providerName?: string;
  distributor?: string;
  description?: string;
  subjects?: string[];
  format?: BookFormat;

  // --- OPF/EPUB metadata extensions ---
  language?: string;
  rights?: string;
  identifiers?: string[];
  opfRaw?: string; // Raw OPF XML (optional, for debugging)

  // --- Accessibility metadata (from OPF) ---
  accessModes?: string[];
  accessModesSufficient?: string[];
  accessibilityFeatures?: string[];
  hazards?: string[];
  accessibilitySummary?: string;
  certificationConformsTo?: string[];
  certification?: string;

  // --- User-friendly accessibility feedback (mapped) ---
  accessibilityFeedback?: string;
}

/**
 * Book query filters for repository operations
 */
export interface BookQueryFilters {
  author?: string;
  title?: string;
  providerId?: string;
  format?: BookFormat;
}

/**
 * Book sort options
 */
export type BookSortField = 'title' | 'author' | 'publicationDate' | 'id';
export type BookSortOrder = 'asc' | 'desc';

export interface BookSortOptions {
  field: BookSortField;
  order: BookSortOrder;
}
