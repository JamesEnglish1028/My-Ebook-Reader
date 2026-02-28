/**
 * Custom hooks for MeBooks application.
 * These hooks encapsulate reusable logic and state management patterns.
 */

// Local storage and data management
export { useCatalogs } from './useCatalogs';
export { getFromStorage, saveToStorage, useLocalStorage } from './useLocalStorage';
export { SORT_OPTIONS, useSortedBooks } from './useSortedBooks';
export type { SortOrder } from './useSortedBooks';

// React Query hooks for async data
export {
  bookKeys, useBookMetadata, useBooks, useDeleteBook,
  useUpdateBook,
} from './useBooks';

export {
  catalogKeys, useCatalogContent,
  useCatalogRootCollections,
} from './useCatalogContent';
export {
  catalogSearchKeys, useCatalogSearchDescription,
} from './useCatalogSearchDescription';

// Catalog management mutations
export {
  catalogManagementKeys, useAddCatalog, useAddRegistry, useDeleteCatalogMutation, useDeleteRegistryMutation, useUpdateCatalogMutation, useUpdateRegistryMutation,
} from './useCatalogMutations';

// Accessibility hooks
export { useGridNavigation, useKeyboardNavigation } from './useKeyboardNavigation';
export type { GridNavigationOptions, KeyboardNavigationOptions } from './useKeyboardNavigation';

export { useFocusManagement, useFocusTrap } from './useFocusTrap';
export type { FocusTrapOptions } from './useFocusTrap';

export { formatShortcut, getShortcutsByCategory, registerShortcut, shortcutRegistry, unregisterShortcut, useGlobalShortcuts } from './useGlobalShortcuts';
export type { GlobalShortcutsOptions, ShortcutAction } from './useGlobalShortcuts';
