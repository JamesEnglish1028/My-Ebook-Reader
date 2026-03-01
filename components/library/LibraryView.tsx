import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { mebooksBook } from '../../assets';
import { useAuth } from '../../contexts/AuthContext';
import { bookKeys, useCatalogs, useUiTheme } from '../../hooks';
import { db, logger } from '../../services';
import type { BookMetadata, BookRecord, Catalog, CatalogBook, CatalogRegistry, CoverAnimationData } from '../../types';
import DuplicateBookModal from '../DuplicateBookModal';
import { ChevronDownIcon, ListIcon } from '../icons';
import ManageCatalogsModal from '../ManageCatalogsModal';

import { CatalogView } from './catalog';
import { ImportButton, LocalLibraryView } from './local';

interface LibraryViewProps {
  libraryRefreshFlag: number;
  syncStatus: {
    state: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
  };
  onAutoBackupToDrive: () => Promise<void>;
  onOpenBook: (id: number, animationData: CoverAnimationData, format?: string) => void;
  onShowBookDetail: (book: BookMetadata | CatalogBook, source: 'library' | 'catalog', catalogName?: string) => void;
  processAndSaveBook: (
    epubData: ArrayBuffer,
    fileName?: string,
    authorName?: string,
    source?: 'file' | 'catalog',
    providerName?: string,
    providerId?: string,
    format?: string,
    coverImageUrl?: string | null,
    catalogBookMeta?: Partial<CatalogBook>,
  ) => Promise<{ success: boolean; bookRecord?: BookRecord, existingBook?: BookRecord }>;
  importStatus: { isLoading: boolean; message: string; error: string | null; };
  setImportStatus: React.Dispatch<React.SetStateAction<{ isLoading: boolean; message: string; error: string | null; }>>;
  activeOpdsSource: Catalog | CatalogRegistry | null;
  setActiveOpdsSource: React.Dispatch<React.SetStateAction<Catalog | CatalogRegistry | null>>;
  catalogNavPath: { name: string, url: string }[];
  setCatalogNavPath: React.Dispatch<React.SetStateAction<{ name: string, url: string }[]>>;
  onOpenCloudSyncModal: () => void;
  onOpenLocalStorageModal: () => void;
  onShowAbout: () => void;
}

/**
 * LibraryView - Main coordinator for library functionality
 *
 * Coordinates between local library and catalog browsing views.
 * Manages the header, navigation, and source selection.
 */
const LibraryView: React.FC<LibraryViewProps> = ({
  onAutoBackupToDrive,
  onOpenBook,
  onShowBookDetail,
  processAndSaveBook,
  importStatus,
  setImportStatus,
  activeOpdsSource,
  setActiveOpdsSource,
  catalogNavPath,
  setCatalogNavPath,
  onOpenCloudSyncModal,
  onOpenLocalStorageModal,
  onShowAbout,
  libraryRefreshFlag,
  syncStatus,
}) => {
  // Use libraryRefreshFlag to trigger refreshes in child components if needed
  // React Query client for cache invalidation
  const queryClient = useQueryClient();
  const { user, isLoggedIn, signIn, signOut, authStatus, isInitialized } = useAuth();
  const { uiTheme, setUiTheme } = useUiTheme();

  // Catalog management
  const {
    catalogs,
    registries,
    addCatalog,
    deleteCatalog,
    updateCatalog,
    addRegistry,
    deleteRegistry,
    updateRegistry,
  } = useCatalogs();

  // UI state
  const [isCatalogDropdownOpen, setIsCatalogDropdownOpen] = useState(false);
  const [isManageCatalogsOpen, setIsManageCatalogsOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  // Duplicate book modal
  const [duplicateBook, setDuplicateBook] = useState<BookRecord | null>(null);
  const [existingBook, setExistingBook] = useState<BookRecord | null>(null);

  // Refs for click-outside detection
  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCatalogDropdownOpen(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle source selection
  const handleSelectSource = useCallback((source: 'library' | Catalog | CatalogRegistry) => {
    if (source === 'library') {
      setActiveOpdsSource(null);
      setCatalogNavPath([]);
    } else {
      setActiveOpdsSource(source);
      setCatalogNavPath([{ name: source.name, url: source.url }]);
    }
    setIsCatalogDropdownOpen(false);
  }, [setActiveOpdsSource, setCatalogNavPath]);

  // Handle catalog CRUD operations
  const handleAddCatalog = useCallback((name: string, url: string, opdsVersion: 'auto' | '1' | '2' = 'auto') => {
    addCatalog(name, url, opdsVersion);
  }, [addCatalog]);

  const handleDeleteCatalog = useCallback((id: string) => {
    deleteCatalog(id);
    if (activeOpdsSource?.id === id) {
      handleSelectSource('library');
    }
  }, [deleteCatalog, activeOpdsSource, handleSelectSource]);

  const handleUpdateCatalog = useCallback((id: string, newName: string) => {
    updateCatalog(id, { name: newName });
    if (activeOpdsSource?.id === id) {
      setActiveOpdsSource(prev => prev ? { ...prev, name: newName } : null);
      setCatalogNavPath(prev => {
        if (prev.length > 0) {
          const newPath = [...prev];
          newPath[0] = { ...newPath[0], name: newName };
          return newPath;
        }
        return prev;
      });
    }
  }, [updateCatalog, activeOpdsSource, setActiveOpdsSource, setCatalogNavPath]);

  // Handle registry CRUD operations
  const handleAddRegistry = useCallback((name: string, url: string) => {
    addRegistry(name, url);
  }, [addRegistry]);

  const handleDeleteRegistry = useCallback((id: string) => {
    deleteRegistry(id);
    if (activeOpdsSource?.id === id) {
      handleSelectSource('library');
    }
  }, [deleteRegistry, activeOpdsSource, handleSelectSource]);

  const handleUpdateRegistry = useCallback((id: string, newName: string) => {
    updateRegistry(id, { name: newName });
    if (activeOpdsSource?.id === id) {
      setActiveOpdsSource(prev => prev ? { ...prev, name: newName } : null);
    }
  }, [updateRegistry, activeOpdsSource, setActiveOpdsSource]);

  // Handle file import - NOT using useCallback to prevent recreation issues
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[LibraryView] handleFileChange called', event.target.files);

    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log('[LibraryView] No file selected');
      return;
    }

    const file = files[0];
    setIsSettingsMenuOpen(false);
    console.log('[LibraryView] File selected:', file.name, file.type, file.size);

    // If file size is 0, the file object is already invalid
    // This commonly happens with iCloud-synced files on macOS that haven't been downloaded locally
    if (file.size === 0) {
      console.error('[LibraryView] File size is 0 - file object is invalid!');

      // Check if this looks like an ebook file that might be stored in iCloud
      const isEbookExtension = /\.(epub|pdf)$/i.test(file.name);
      const errorMessage = isEbookExtension
        ? 'Unable to access file. If this file is stored in iCloud, right-click it in Finder and select "Download Now" to make it available locally, then try again.'
        : 'Unable to access file. Please try again.';

      setImportStatus({ isLoading: false, message: '', error: errorMessage });
      event.target.value = '';
      return;
    }

    // Capture file metadata immediately
    const fileName = file.name;
    const fileType = file.type;
    const format = fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'EPUB';

    // Try to create a stable blob reference immediately
    console.log('[LibraryView] Creating blob from file...');
    const blob = file.slice(0, file.size, file.type);

    // Start reading from the blob IMMEDIATELY before any state updates
    const reader = new FileReader();
    console.log('[LibraryView] Starting FileReader.readAsArrayBuffer from blob...');
    reader.readAsArrayBuffer(blob);

    // Now update state AFTER we've started reading
    setImportStatus({ isLoading: true, message: 'Reading file...', error: null });

    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;

      if (!arrayBuffer) {
        setImportStatus({ isLoading: false, message: '', error: 'Could not read file data.' });
        return;
      }

      console.log('[LibraryView] File read successfully, calling processAndSaveBook...', {
        fileName,
        size: arrayBuffer.byteLength,
      });

      try {
        const result = await processAndSaveBook(arrayBuffer, fileName, undefined, 'file', undefined, undefined, format);

        console.log('[LibraryView] processAndSaveBook result:', result);

        if (result.success) {
          // Invalidate books query to refresh the library
          console.log('[LibraryView] Invalidating books query cache...');
          await queryClient.invalidateQueries({ queryKey: bookKeys.all });
          console.log('[LibraryView] Books query cache invalidated');

          void onAutoBackupToDrive();

          setImportStatus({ isLoading: false, message: 'Import successful!', error: null });
          setTimeout(() => setImportStatus({ isLoading: false, message: '', error: null }), 2000);
        } else if (!result.success && result.bookRecord && result.existingBook) {
          console.log('[LibraryView] Duplicate book detected');
          setDuplicateBook(result.bookRecord);
          setExistingBook(result.existingBook);
          setImportStatus({ isLoading: false, message: '', error: null });
        }
      } catch (error: any) {
        console.error('[LibraryView] Error during processAndSaveBook:', error);
        setImportStatus({ isLoading: false, message: '', error: error.message || 'Failed to import book' });
      }

      // Reset input AFTER all processing is complete
      event.target.value = '';
    };

    reader.onerror = (e) => {
      console.error('[LibraryView] FileReader error:', {
        error: reader.error,
        errorName: reader.error?.name,
        errorMessage: reader.error?.message,
        event: e,
      });
      setImportStatus({ isLoading: false, message: '', error: `File read error: ${reader.error?.message || 'Unknown error'}` });
      event.target.value = '';
    };
  };

  const handleReplaceBook = useCallback(async () => {
    if (!duplicateBook || !existingBook) return;

    setImportStatus({ isLoading: true, message: 'Replacing book...', error: null });
    const bookToSave = { ...duplicateBook, id: existingBook.id };

    setDuplicateBook(null);
    setExistingBook(null);

    try {
      await db.saveBook(bookToSave);
      if (!activeOpdsSource) {
        await queryClient.invalidateQueries({ queryKey: bookKeys.all });
      }
      setImportStatus({ isLoading: false, message: 'Import successful!', error: null });
      setTimeout(() => setImportStatus({ isLoading: false, message: '', error: null }), 2000);
    } catch (error) {
      logger.error('Error replacing book:', error);
      setImportStatus({ isLoading: false, message: '', error: 'Failed to replace the book in the library.' });
    }
}, [activeOpdsSource, duplicateBook, existingBook, queryClient, setImportStatus]);

  const handleAddAnyway = useCallback(async () => {
    if (!duplicateBook) return;

    setImportStatus({ isLoading: true, message: 'Saving new copy...', error: null });
    const bookToSave = { ...duplicateBook };

    setDuplicateBook(null);
    setExistingBook(null);

    try {
      await db.saveBook(bookToSave);
      if (!activeOpdsSource) {
        await queryClient.invalidateQueries({ queryKey: bookKeys.all });
      }
      setImportStatus({ isLoading: false, message: 'Import successful!', error: null });
      setTimeout(() => setImportStatus({ isLoading: false, message: '', error: null }), 2000);
    } catch (error) {
      logger.error('Error adding duplicate book:', error);
      setImportStatus({ isLoading: false, message: '', error: 'Failed to add the new copy to the library.' });
    }
  }, [activeOpdsSource, duplicateBook, queryClient, setImportStatus]);

  const handleCancelDuplicate = useCallback(() => {
    setDuplicateBook(null);
    setExistingBook(null);
    setImportStatus({ isLoading: false, message: '', error: null });
  }, [setImportStatus]);

  const currentTitle = activeOpdsSource ? activeOpdsSource.name : 'My Library';
  const isBrowsingOpds = !!activeOpdsSource;
  const lastSyncDate = localStorage.getItem('ebook-reader-last-sync');
  const lastSyncLabel = lastSyncDate ? new Date(lastSyncDate).toLocaleString() : 'Never';
  const syncSummary = syncStatus.state === 'idle' ? `Last synced ${lastSyncLabel}` : syncStatus.message;
  const syncSummaryTone = syncStatus.state === 'error'
    ? 'theme-text-danger'
    : syncStatus.state === 'success'
      ? 'theme-text-success'
      : syncStatus.state === 'syncing'
        ? 'theme-text-info'
        : 'theme-text-muted';
  const canSignIn = isInitialized && authStatus !== 'initializing' && authStatus !== 'not_configured';

  return (
    <div className="container mx-auto p-4 md:p-8 theme-text-primary">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        {/* Title with source dropdown */}
        <div className="flex items-center gap-4">
          <img src={mebooksBook} alt="MeBooks Logo" className="w-10 h-10 flex-shrink-0" />
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setIsCatalogDropdownOpen(prev => !prev)}
              className="theme-text-primary flex items-center gap-2 text-left"
              aria-label="Select book source"
              aria-expanded={isCatalogDropdownOpen ? 'true' : 'false'}
              aria-haspopup="true"
            >
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                {currentTitle}
              </h1>
              <ChevronDownIcon className={`w-6 h-6 transition-transform flex-shrink-0 mt-1 md:mt-2 ${isCatalogDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Source Dropdown */}
            {isCatalogDropdownOpen && (
              <div className="theme-surface-elevated theme-border absolute top-full z-20 mt-2 w-72 rounded-lg border shadow-xl">
                <ul className="theme-text-primary max-h-96 overflow-y-auto p-1">
                  <li>
                    <button onClick={() => handleSelectSource('library')} className={`w-full rounded-md px-3 py-2 text-left text-sm ${!isBrowsingOpds ? 'bg-sky-600' : 'theme-hover-surface'}`}>
                      My Library
                    </button>
                  </li>
                  {(catalogs.length > 0 || registries.length > 0) && <li className="theme-divider my-1 border-t" />}

                  {catalogs.length > 0 && <>
                    <li className="theme-text-secondary px-3 pb-1 pt-2 text-xs font-semibold uppercase">Catalogs</li>
                    {catalogs.map(catalog => (
                      <li key={catalog.id}>
                        <button onClick={() => handleSelectSource(catalog)} className={`w-full truncate rounded-md px-3 py-2 text-left text-sm ${isBrowsingOpds && activeOpdsSource?.id === catalog.id ? 'bg-sky-600' : 'theme-hover-surface'}`}>
                          {catalog.name}
                        </button>
                      </li>
                    ))}
                  </>}

                  {registries.length > 0 && <>
                    <li className="theme-text-secondary px-3 pb-1 pt-2 text-xs font-semibold uppercase">Registries</li>
                    {registries.map(registry => (
                      <li key={registry.id}>
                        <button onClick={() => handleSelectSource(registry)} className={`w-full truncate rounded-md px-3 py-2 text-left text-sm ${isBrowsingOpds && activeOpdsSource?.id === registry.id ? 'bg-sky-600' : 'theme-hover-surface'}`}>
                          {registry.name}
                        </button>
                      </li>
                    ))}
                  </>}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-auto">
          {/* Settings Menu */}
          <div ref={settingsMenuRef} className="relative">
            <button
              onClick={() => setIsSettingsMenuOpen(prev => !prev)}
              className="theme-surface theme-border theme-text-secondary h-[36px] w-[36px] cursor-pointer rounded-md p-2 inline-flex items-center justify-center transition-colors duration-200"
              aria-label="Open main menu"
            >
              <ListIcon className="w-4 h-4" />
            </button>
            {isSettingsMenuOpen && (
              <div className="theme-surface-elevated theme-border absolute top-full right-0 z-20 mt-2 w-64 overflow-hidden rounded-md shadow-xl backdrop-blur-sm">
                <div className="theme-surface-muted theme-divider px-3 py-2.5 border-b">
                  {isLoggedIn && user ? (
                    <button
                      onClick={() => {
                        signOut();
                        setIsSettingsMenuOpen(false);
                      }}
                      className="theme-hover-surface flex w-full items-center gap-2.5 rounded-sm px-1 py-1 text-left transition-colors"
                      aria-label={`Signed in as ${user.name}. Click to sign out`}
                    >
                      <img
                        src={user.picture}
                        alt={`${user.name} profile`}
                        className="w-8 h-8 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <p className="theme-text-primary truncate text-[13px] font-medium leading-tight">{user.name}</p>
                        <p className="theme-text-muted truncate text-[11px] leading-tight">{user.email}</p>
                      </div>
                    </button>
                  ) : (
                    <p className="theme-text-secondary text-[12px] font-medium">Browsing locally</p>
                  )}
                  <p className={`mt-2 text-[11px] leading-tight ${syncSummaryTone}`}>{syncSummary}</p>
                </div>
                <ul className="theme-text-primary p-1.5">
                  {!isLoggedIn && (
                    <li>
                      <button
                        onClick={() => {
                          signIn();
                          setIsSettingsMenuOpen(false);
                        }}
                        disabled={!canSignIn}
                        className="theme-text-secondary theme-hover-surface block w-full rounded-sm px-2.5 py-2 text-left text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Log In
                      </button>
                    </li>
                  )}
                  {!isLoggedIn && <li className="theme-divider my-1 border-t" />}
                  {!isBrowsingOpds && (
                    <li>
                      <ImportButton
                        isLoading={importStatus.isLoading}
                        onFileChange={handleFileChange}
                        alwaysShowLabel={true}
                        className="theme-text-primary theme-hover-surface w-full justify-start rounded-sm border-0 bg-transparent px-2.5 py-2 text-[13px] font-medium"
                      />
                    </li>
                  )}
                  {!isBrowsingOpds && <li className="theme-divider my-1 border-t" />}
                  <li>
                    <button
                      onClick={() => {
                        setIsManageCatalogsOpen(true);
                        setIsSettingsMenuOpen(false);
                      }}
                        className="theme-text-secondary theme-hover-surface block w-full rounded-sm px-2.5 py-2 text-left text-[13px]"
                    >
                      Manage Sources
                    </button>
                  </li>
                  <li className="theme-divider my-1 border-t" />
                  <li className="px-2.5 py-2">
                    <p className="theme-text-muted mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]">Theme</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['system', 'light', 'dark'] as const).map((themeOption) => (
                        <button
                          key={themeOption}
                          onClick={() => setUiTheme(themeOption)}
                          className={`rounded-sm px-2 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                            uiTheme === themeOption
                              ? 'bg-sky-600 text-white'
                              : 'theme-button-neutral theme-hover-surface'
                          }`}
                        >
                          {themeOption}
                        </button>
                      ))}
                    </div>
                  </li>
                  <li className="theme-divider my-1 border-t" />
                  <li>
                    <button
                      onClick={() => {
                        onOpenLocalStorageModal();
                        setIsSettingsMenuOpen(false);
                      }}
                      className="theme-text-secondary theme-hover-surface block w-full rounded-sm px-2.5 py-2 text-left text-[13px]"
                    >
                      Local Storage
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        onOpenCloudSyncModal();
                        setIsSettingsMenuOpen(false);
                      }}
                      className="theme-text-secondary theme-hover-surface block w-full rounded-sm px-2.5 py-2 text-left text-[13px]"
                    >
                      Cloud Sync
                    </button>
                  </li>
                  <li className="theme-divider my-1 border-t" />
                  <li>
                    <button
                      onClick={() => {
                        onShowAbout();
                        setIsSettingsMenuOpen(false);
                      }}
                      className="theme-text-secondary theme-hover-surface block w-full rounded-sm px-2.5 py-2 text-left text-[13px]"
                    >
                      About
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section aria-label="Library content">
        {isBrowsingOpds && activeOpdsSource ? (
          <CatalogView
            activeOpdsSource={activeOpdsSource}
            catalogNavPath={catalogNavPath}
            setCatalogNavPath={setCatalogNavPath}
            onShowBookDetail={onShowBookDetail}
          />
        ) : (
          <LocalLibraryView
            libraryRefreshFlag={libraryRefreshFlag}
            onOpenBook={onOpenBook}
            onShowBookDetail={onShowBookDetail}
            onFileChange={handleFileChange}
            importStatus={importStatus}
          />
        )}
      </section>

      {/* Modals */}
      <ManageCatalogsModal
        isOpen={isManageCatalogsOpen}
        onClose={() => setIsManageCatalogsOpen(false)}
        catalogs={catalogs}
        onAddCatalog={handleAddCatalog}
        onDeleteCatalog={handleDeleteCatalog}
        onUpdateCatalog={handleUpdateCatalog}
        registries={registries}
        onAddRegistry={handleAddRegistry}
        onDeleteRegistry={handleDeleteRegistry}
        onUpdateRegistry={handleUpdateRegistry}
      />

      <DuplicateBookModal
        isOpen={!!duplicateBook}
        onClose={handleCancelDuplicate}
        onReplace={handleReplaceBook}
        onAddAnyway={handleAddAnyway}
        bookTitle={duplicateBook?.title || ''}
      />
    </div>
  );
};

export default LibraryView;
