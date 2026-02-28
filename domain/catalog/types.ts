/**
 * Catalog Domain Types
 *
 * This module defines all types related to OPDS catalogs, browsing, and acquisition.
 * Books in this domain are "available" but not yet owned by the user.
 */

/**
 * Catalog configuration stored by the user
 */
export interface Catalog {
  id: string;
  name: string;
  url: string;
  // OPDS version: 'auto' (detect), '1' (Atom/XML), '2' (JSON)
  opdsVersion?: 'auto' | '1' | '2';
}

/**
 * Catalog registry entry (predefined catalogs)
 */
export interface CatalogRegistry {
  id: string;
  name: string;
  url: string;
}

/**
 * Acquisition format option for a book
 */
export interface AcquisitionFormat {
  format: 'EPUB' | 'PDF' | string;
  downloadUrl: string;
  mediaType?: string; // e.g., application/epub+zip, application/pdf
  isOpenAccess?: boolean;
}

/**
 * Book as it appears in a catalog (not yet in library)
 */
export interface CatalogBook {
  title: string;
  author: string;
  coverImage: string | null;
  downloadUrl: string; // Primary acquisition link (preferred format)
  summary: string | null;
  publisher?: string;
  publicationDate?: string;
  providerId?: string; // Unique ID from the catalog
  distributor?: string; // Distribution provider name
  subjects?: string[];
  contributors?: string[];
  format?: 'EPUB' | 'PDF' | string;

  // OPDS-specific metadata
  acquisitionMediaType?: string; // e.g., application/epub+zip
  mediaType?: string; // e.g., http://schema.org/EBook
  isOpenAccess?: boolean; // True if acquisition link is open-access (no auth required)
  availabilityStatus?: string; // e.g., available, unavailable

  // Multiple format options (when book is available in EPUB and PDF)
  alternativeFormats?: AcquisitionFormat[];

  // OPDS 1 collections
  collections?: Collection[];

  // OPDS 2 series
  series?: Series;

  // Palace.io categories
  categories?: Category[];

  // Publication type (Schema.org)
  schemaOrgType?: string;
  publicationTypeLabel?: string;

  // Media type for non-book publications (from acquisition link)
  mediumFormatCode?: string;
}

/**
 * Collection metadata (OPDS 1)
 */
export interface Collection {
  title: string;
  href: string;
  description?: string;
}

/**
 * Series metadata (OPDS 2)
 */
export interface Series {
  name: string;
  position?: number;
}

/**
 * Category metadata (Palace.io OPDS 1)
 */
export interface Category {
  scheme: string;
  term: string;
  label: string;
}

/**
 * Category lane for UI display
 */
export interface CategoryLane {
  category: Category;
  books: CatalogBook[];
}

/**
 * Collection group for UI display
 */
export interface CollectionGroup {
  collection: Collection;
  books: CatalogBook[];
}

/**
 * Navigation link in catalog tree
 */
export interface CatalogNavigationLink {
  title: string;
  url: string;
  rel: string;
  type?: string;
  isCatalog?: boolean;
  source?: 'navigation' | 'group' | 'registry' | 'compat';

  // Tree view state
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: CatalogNavigationLink[];

  // Internal state flags
  _hasFetchedChildren?: boolean;
  _canExpand?: boolean;
}

/**
 * A facet option for the current feed.
 * Facets refine or alter the current acquisition feed and are distinct from
 * hierarchical navigation links.
 */
export interface CatalogFacetLink {
  title: string;
  url: string;
  type?: string;
  rel?: string;
  count?: number;
  isActive?: boolean;
}

/**
 * A labeled group of facet links.
 */
export interface CatalogFacetGroup {
  title: string;
  links: CatalogFacetLink[];
}

/**
 * Catalog pagination metadata
 */
export interface CatalogPagination {
  next?: string;
  prev?: string;
  first?: string;
  last?: string;
}

/**
 * Catalog with collections organization
 */
export interface CatalogWithCollections {
  books: CatalogBook[];
  navLinks: CatalogNavigationLink[];
  facetGroups?: CatalogFacetGroup[];
  pagination: CatalogPagination;
  collections: CollectionGroup[];
  uncategorizedBooks: CatalogBook[];
}

/**
 * Catalog with categories organization
 */
export interface CatalogWithCategories {
  books: CatalogBook[];
  navLinks: CatalogNavigationLink[];
  facetGroups?: CatalogFacetGroup[];
  pagination: CatalogPagination;
  categoryLanes: CategoryLane[];
  collectionLinks: Collection[];
  uncategorizedBooks: CatalogBook[];
}

/**
 * OPDS Authentication document
 */
export interface AuthDocument {
  type?: string;
  title?: string;
  description?: string;
  links?: {
    rel?: string;
    href?: string;
    type?: string;
    title?: string;
  }[];
  authentication?: {
    type?: string;
    description?: string;
    inputs?: Record<string, unknown>;
  }[];
  username_hint?: string;
  password_hint?: string;
}

/**
 * Credential prompt state for UI
 */
export interface CredentialPrompt {
  isOpen: boolean;
  host: string | null;
  pendingHref?: string | null;
  pendingBook?: CatalogBook | null;
  pendingCatalogName?: string;
  authDocument?: AuthDocument | null;
}

/**
 * Stored credentials for a catalog host
 */
export interface StoredCredentials {
  host: string;
  username: string;
  password: string;
}

/**
 * Filter modes for catalog display
 */
export type CategorizationMode = 'subject' | 'flat';
export type AudienceMode = 'all' | 'adult' | 'young-adult' | 'children';
export type FictionMode = 'all' | 'fiction' | 'non-fiction';
export type MediaMode = 'all' | 'epub' | 'pdf' | 'audiobook';
export type PublicationMode = 'all' | string;
export type AvailabilityMode = 'all' | string;
export type DistributorMode = 'all' | string;
export type CollectionMode = 'all' | string; // 'all' or specific collection name
