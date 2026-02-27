/**
 * Sync Domain Types
 *
 * This module defines types related to cloud synchronization,
 * primarily for Google Drive integration.
 */

import type { BookRecord } from '../book/types';
import type { Catalog } from '../catalog/types';
import type { Bookmark, Citation, ReaderSettings } from '../reader/types';

/**
 * Google user profile information
 */
export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

/**
 * Complete sync payload for Google Drive
 * Contains all user data except binary book content
 */
export interface SyncPayload {
  // Book metadata (without epubData ArrayBuffer)
  library: Omit<BookRecord, 'epubData'>[];

  // User's configured catalogs
  catalogs: Catalog[];

  // Bookmarks mapped by book ID
  bookmarks: Record<number, Bookmark[]>;

  // Citations mapped by book ID
  citations: Record<number, Citation[]>;

  // Reading positions mapped by book ID
  positions: Record<number, string | null>;

  // Reader settings
  settings: ReaderSettings;

  // Sync metadata
  syncedAt?: number; // Unix timestamp
  version?: string; // App version that created the sync
}

/**
 * Sync status information
 */
export interface SyncStatus {
  lastSyncAt: number | null;
  isSyncing: boolean;
  error: string | null;
}

/**
 * Metadata snapshot entry stored in Google Drive.
 * Used to select a rollback point when restoring.
 */
export interface DriveSnapshot {
  id: string;
  name: string;
  createdAt: string;
  isLatest: boolean;
}

/**
 * Sync conflict resolution strategy
 */
export type ConflictResolutionStrategy = 'local' | 'remote' | 'merge';

/**
 * Sync conflict detected between local and remote data
 */
export interface SyncConflict {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  localTimestamp: number;
  remoteTimestamp: number;
}
