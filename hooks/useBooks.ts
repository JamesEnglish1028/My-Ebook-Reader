import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bookRepository } from '../domain/book';
import { logger } from '../services/logger';
import type { BookMetadata } from '../types';

// Query keys for React Query cache management
export const bookKeys = {
  all: ['books'] as const,
  detail: (id: number) => ['books', id] as const,
  metadata: (id: number) => ['books', id, 'metadata'] as const,
};

/**
 * useBooks - Query hook for fetching all books from the library
 *
 * Fetches book metadata from IndexedDB and caches the result.
 * Automatically refetches on window focus for fresh data.
 *
 * @returns Query result with books data, loading state, and error state
 *
 * @example
 * const { data: books, isLoading, error } = useBooks();
 */
export function useBooks() {
  return useQuery({
    queryKey: bookKeys.all,
    queryFn: async (): Promise<BookMetadata[]> => {
      const result = await bookRepository.findAllMetadata();

      if (result.success) {
        return result.data;
      } else {
        const errorMessage = (result as { success: false; error: string }).error;
        logger.error('Failed to fetch books from repository:', errorMessage);
        throw new Error(errorMessage);
      }
    },
  });
}

/**
 * useBookMetadata - Query hook for fetching a single book's metadata
 *
 * @param bookId - The ID of the book to fetch
 * @returns Query result with book metadata
 *
 * @example
 * const { data: book, isLoading } = useBookMetadata(bookId);
 */
export function useBookMetadata(bookId: number | null) {
  return useQuery({
    queryKey: bookKeys.metadata(bookId!),
    queryFn: async (): Promise<BookMetadata | null> => {
      if (!bookId) return null;

      const result = await bookRepository.findById(bookId);

      if (result.success) {
        // Convert BookRecord to BookMetadata (add id if missing)
        const book = result.data;
        if (!book.id) {
          throw new Error(`Book ${bookId} has no ID`);
        }

        return {
          id: book.id,
          title: book.title,
          author: book.author,
          coverImage: book.coverImage,
          publisher: book.publisher,
          publicationDate: book.publicationDate,
          isbn: book.isbn,
          providerId: book.providerId,
          providerName: book.providerName,
          contentExcludedFromSync: book.contentExcludedFromSync,
          requiresReauthorization: book.requiresReauthorization,
          restoredFromSync: book.restoredFromSync,
          distributor: book.distributor,
          description: book.description,
          subjects: book.subjects,
          format: book.format,
        };
      } else {
        const errorMessage = (result as { success: false; error: string }).error;
        logger.error(`Failed to fetch book ${bookId}:`, errorMessage);
        throw new Error(errorMessage);
      }
    },
    enabled: bookId !== null, // Only run query if bookId is provided
  });
}

/**
 * useDeleteBook - Mutation hook for deleting a book
 *
 * Deletes a book from IndexedDB and invalidates the books cache.
 *
 * @returns Mutation object with mutate function and state
 *
 * @example
 * const { mutate: deleteBook, isPending } = useDeleteBook();
 * deleteBook(bookId, {
 *   onSuccess: () => console.log('Book deleted'),
 *   onError: (error) => console.error('Delete failed', error),
 * });
 */
export function useDeleteBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookId: number): Promise<void> => {
      const result = await bookRepository.delete(bookId);

      if (!result.success) {
        const errorMessage = (result as { success: false; error: string }).error;
        logger.error(`Failed to delete book ${bookId}:`, errorMessage);
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      // Invalidate and refetch books list
      queryClient.invalidateQueries({ queryKey: bookKeys.all });
    },
  });
}

/**
 * useUpdateBook - Mutation hook for updating a book
 *
 * Updates a book in IndexedDB and invalidates relevant caches.
 *
 * @returns Mutation object with mutate function and state
 *
 * @example
 * const { mutate: updateBook } = useUpdateBook();
 * updateBook({ id: bookId, updates: { title: 'New Title' } });
 */
export function useUpdateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<BookMetadata> }): Promise<void> => {
      const result = await bookRepository.update(id, updates);

      if (!result.success) {
        const errorMessage = (result as { success: false; error: string }).error;
        logger.error(`Failed to update book ${id}:`, errorMessage);
        throw new Error(errorMessage);
      }
    },
    onSuccess: (_, { id }) => {
      // Invalidate specific book and books list
      queryClient.invalidateQueries({ queryKey: bookKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bookKeys.metadata(id) });
      queryClient.invalidateQueries({ queryKey: bookKeys.all });
    },
  });
}
