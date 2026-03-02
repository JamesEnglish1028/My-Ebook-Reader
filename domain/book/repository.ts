/**
 * Book Repository
 *
 * Manages persistence of books in IndexedDB using the Repository pattern.
 * This provides a clean abstraction over database operations and enables
 * easier testing and potential migration to other storage backends.
 */

import { DB_INDEXES, DB_NAME, DB_VERSION, STORE_NAME } from '../../constants';
import { logger } from '../../services/logger';

import type { BookMetadata, BookRecord } from './types';

/**
 * Result wrapper for repository operations
 */
export type RepositoryResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Book Repository - handles all book persistence operations
 */
export class BookRepository {
  private dbInstance: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB connection
   */
  private async init(): Promise<IDBDatabase> {
    if (this.dbInstance) {
      return this.dbInstance;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('IndexedDB error:', request.error);
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.dbInstance = request.result;
        resolve(this.dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        let store: IDBObjectStore;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex(DB_INDEXES.TITLE, DB_INDEXES.TITLE, { unique: false });
        } else {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            store = transaction.objectStore(STORE_NAME);
          } else {
            return;
          }
        }

        // Migration: Add ISBN index (version 2)
        if (event.oldVersion < 2) {
          if (!store.indexNames.contains(DB_INDEXES.ISBN)) {
            store.createIndex(DB_INDEXES.ISBN, DB_INDEXES.ISBN, { unique: false });
          }
        }

        // Migration: Add providerId index (version 3)
        if (event.oldVersion < 3) {
          if (!store.indexNames.contains(DB_INDEXES.PROVIDER_ID)) {
            store.createIndex(DB_INDEXES.PROVIDER_ID, DB_INDEXES.PROVIDER_ID, { unique: false });
          }
        }
      };
    });
  }

  /**
   * Save a book to the library
   * @param book - Book data to save
   * @returns The ID of the saved book
   */
  async save(book: BookRecord): Promise<RepositoryResult<number>> {
    try {
      const db = await this.init();
      const id = await new Promise<number>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(book);

        request.onsuccess = () => {
          resolve(request.result as number);
        };

        request.onerror = () => {
          logger.error('Error saving book:', request.error);
          reject(new Error('Failed to save book'));
        };
      });

      logger.info(`Book saved successfully with ID: ${id}`);
      return { success: true, data: id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error saving book';
      logger.error('BookRepository.save error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Find a book by its ID
   * @param id - Book ID
   * @returns The book or null if not found
   */
  async findById(id: number): Promise<RepositoryResult<BookRecord | null>> {
    try {
      const db = await this.init();
      const book = await new Promise<BookRecord | undefined>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          resolve(request.result as BookRecord | undefined);
        };

        request.onerror = () => {
          logger.error('Error getting book:', request.error);
          reject(new Error('Failed to get book'));
        };
      });

      return { success: true, data: book || null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error finding book';
      logger.error('BookRepository.findById error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Find book metadata by ID (without binary data)
   * @param id - Book ID
   * @returns Book metadata or null if not found
   */
  async findMetadataById(id: number): Promise<RepositoryResult<BookMetadata | null>> {
    try {
      const result = await this.findById(id);

      if (!result.success) {
        return { success: false, error: 'Failed to find book metadata' };
      }

      if (!result.data) {
        return { success: true, data: null };
      }

      const bookRecord = result.data;
      const metadata: BookMetadata = {
        id: bookRecord.id!,
        title: bookRecord.title,
        author: bookRecord.author,
        coverImage: bookRecord.coverImage,
        publisher: bookRecord.publisher,
        publicationDate: bookRecord.publicationDate,
        isbn: bookRecord.isbn,
        providerId: bookRecord.providerId,
        providerName: bookRecord.providerName,
        distributor: bookRecord.distributor,
        description: bookRecord.description,
        subjects: bookRecord.subjects,
        format: bookRecord.format,
        language: bookRecord.language,
        rights: bookRecord.rights,
        identifiers: bookRecord.identifiers,
        opfRaw: bookRecord.opfRaw,
        accessModes: bookRecord.accessModes,
        accessModesSufficient: bookRecord.accessModesSufficient,
        accessibilityFeatures: bookRecord.accessibilityFeatures,
        hazards: bookRecord.hazards,
        accessibilitySummary: bookRecord.accessibilitySummary,
        certificationConformsTo: bookRecord.certificationConformsTo,
        certification: bookRecord.certification,
        accessibilityFeedback: bookRecord.accessibilityFeedback,
      };

      return { success: true, data: metadata };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error finding metadata';
      logger.error('BookRepository.findMetadataById error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get all books in the library
   * @returns Array of all books
   */
  async findAll(): Promise<RepositoryResult<BookRecord[]>> {
    try {
      const db = await this.init();
      const books = await new Promise<BookRecord[]>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result as BookRecord[]);
        };

        request.onerror = () => {
          logger.error('Error getting all books:', request.error);
          reject(new Error('Failed to get all books'));
        };
      });

      return { success: true, data: books };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error finding all books';
      logger.error('BookRepository.findAll error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get metadata for all books (without binary data)
   * @returns Array of book metadata
   */
  async findAllMetadata(): Promise<RepositoryResult<BookMetadata[]>> {
    try {
      const db = await this.init();
      const books = await new Promise<BookMetadata[]>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        const metadata: BookMetadata[] = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const value = cursor.value as BookRecord;
            metadata.push({
              ...value,
              id: typeof value.id === 'number' ? value.id : Number(cursor.primaryKey),
            });
            cursor.continue();
          } else {
            console.log('[BookRepository.findAllMetadata] Loaded metadata:', metadata);
            resolve(metadata);
          }
        };

        request.onerror = () => {
          logger.error('Error getting books metadata:', request.error);
          reject(new Error('Failed to get books metadata'));
        };
      });

      console.log('[BookRepository.findAllMetadata] Returning books:', books);
      return { success: true, data: books };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error finding all metadata';
      logger.error('BookRepository.findAllMetadata error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Find a book by provider ID or ISBN (backward compatible)
   * @param identifier - Provider ID or ISBN to search for
   * @returns The book or null if not found
   */
  async findByIdentifier(identifier: string): Promise<RepositoryResult<BookRecord | null>> {
    if (!identifier) {
      return { success: true, data: null };
    }

    try {
      const db = await this.init();

      const searchByIndex = async (indexName: 'providerId' | 'isbn'): Promise<BookRecord | null> => {
        return new Promise((resolve, reject) => {
          try {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);

            if (!store.indexNames.contains(indexName)) {
              resolve(null);
              return;
            }

            const index = store.index(indexName);
            const request = index.get(identifier);

            request.onsuccess = () => {
              resolve((request.result as BookRecord) || null);
            };

            request.onerror = () => {
              logger.error(`Error finding book by ${indexName}:`, request.error);
              reject(new Error(`Failed to find book by ${indexName}`));
            };
          } catch (e) {
            logger.error(`Error initiating search on index ${indexName}:`, e);
            resolve(null);
          }
        });
      };

      // Try providerId first (modern approach)
      const byProviderId = await searchByIndex('providerId');
      if (byProviderId) {
        return { success: true, data: byProviderId };
      }

      // Fall back to ISBN (backward compatibility)
      const byIsbn = await searchByIndex('isbn');
      return { success: true, data: byIsbn };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error finding by identifier';
      logger.error('BookRepository.findByIdentifier error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete a book from the library
   * @param id - Book ID to delete
   */
  async delete(id: number): Promise<RepositoryResult<void>> {
    try {
      const db = await this.init();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          logger.error('Error deleting book:', request.error);
          reject(new Error('Failed to delete book'));
        };
      });

      logger.info(`Book deleted successfully: ${id}`);
      return { success: true, data: undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting book';
      logger.error('BookRepository.delete error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Clear all books from the library
   * WARNING: This is a destructive operation!
   */
  async deleteAll(): Promise<RepositoryResult<void>> {
    try {
      const db = await this.init();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          logger.error('Error clearing all books:', request.error);
          reject(new Error('Failed to clear all books'));
        };
      });

      logger.warn('All books cleared from library');
      return { success: true, data: undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error clearing all books';
      logger.error('BookRepository.deleteAll error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update an existing book
   * @param id - Book ID
   * @param updates - Partial book data to update
   */
  async update(id: number, updates: Partial<BookRecord>): Promise<RepositoryResult<void>> {
    try {
      const result = await this.findById(id);

      if (!result.success) {
        return { success: false, error: 'Failed to find book for update' };
      }

      if (!result.data) {
        return { success: false, error: 'Book not found' };
      }

      const updatedBook: BookRecord = {
        ...result.data,
        ...updates,
        id, // Ensure ID doesn't change
      };

      const saveResult = await this.save(updatedBook);

      if (!saveResult.success) {
        return { success: false, error: 'Failed to save updated book' };
      }

      return { success: true, data: undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error updating book';
      logger.error('BookRepository.update error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if a book exists by identifier
   * @param identifier - Provider ID or ISBN
   * @returns True if book exists, false otherwise
   */
  async exists(identifier: string): Promise<RepositoryResult<boolean>> {
    const result = await this.findByIdentifier(identifier);

    if (!result.success) {
      return { success: false, error: 'Failed to check if book exists' };
    }

    return { success: true, data: result.data !== null };
  }

  /**
   * Get the total count of books in the library
   * @returns Number of books
   */
  async count(): Promise<RepositoryResult<number>> {
    try {
      const db = await this.init();
      const count = await new Promise<number>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          logger.error('Error counting books:', request.error);
          reject(new Error('Failed to count books'));
        };
      });

      return { success: true, data: count };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error counting books';
      logger.error('BookRepository.count error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}

// Singleton instance for convenience
export const bookRepository = new BookRepository();
