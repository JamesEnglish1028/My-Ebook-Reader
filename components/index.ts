/**
 * Barrel export for all components.
 * Simplifies imports across the application.
 *
 * @example
 * // Before:
 * import Library from './components/Library';
 * import ReaderView from './components/ReaderView';
 * import BookDetailView from './components/BookDetailView';
 *
 * // After:
 * import { Library, ReaderView, BookDetailView } from './components';
 */

// Main view components
export { default as AboutPage } from './AboutPage';
export { default as BookDetailView } from './BookDetailView';
// Library component has been decomposed - use LibraryView from './library/LibraryView' instead
export { default as ReaderView } from './ReaderView';

// Reader-related components
export { default as SearchPanel } from './SearchPanel';
export { default as SettingsPanel } from './SettingsPanel';
export { default as TocPanel } from './TocPanel';

// Modals
export { default as BookmarkModal } from './BookmarkModal';
export { default as CitationModal } from './CitationModal';
export { default as ConfirmModal } from './ConfirmModal';
export { default as DeleteConfirmationModal } from './DeleteConfirmationModal';
export { default as DuplicateBookModal } from './DuplicateBookModal';
export { default as LocalStorageModal } from './LocalStorageModal';
export { default as ManageCatalogsModal } from './ManageCatalogsModal';
export { default as NetworkDebugModal } from './NetworkDebugModal';
export { default as OpdsCredentialsModal } from './OpdsCredentialsModal';
export { default as SettingsModal } from './SettingsModal';
export { default as ShortcutHelpModal } from './ShortcutHelpModal';

// OPDS/Catalog components
export { default as CollectionNavigation } from './CollectionNavigation';

// UI components
export { default as AddedHud } from './AddedHud';
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as ScreenReaderAnnouncer } from './ScreenReaderAnnouncer';
export { default as Spinner } from './Spinner';
export { default as SplashScreen } from './SplashScreen';
export { default as Toast } from './Toast';
export { default as Tooltip } from './Tooltip';
export { default as ZoomHud } from './ZoomHud';

// Logo components
export { Logo } from './Logo';

// Contexts
export { ConfirmProvider, useConfirm } from './ConfirmContext';

// Toast system
export { ToastProvider, useToast } from './toast/ToastContext';
export { default as ToastStack } from './toast/ToastStack';

// Icons - commonly used, exported for convenience
export * from './icons';
