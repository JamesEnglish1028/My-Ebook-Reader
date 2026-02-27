import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { mebooksBook } from '../../assets';
import { useAuth } from '../../contexts/AuthContext';
import { bookKeys, useCatalogs } from '../../hooks';
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
  const { user, isLoggedIn } = useAuth();

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
  const [rootLevelCollections, setRootLevelCollections] = useState<string[]>([]);

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
    ? 'text-red-300'
    : syncStatus.state === 'success'
      ? 'text-emerald-300'
      : syncStatus.state === 'syncing'
        ? 'text-sky-300'
        : 'text-slate-400';

  return (
    <div className="container mx-auto p-4 md:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        {/* Title with source dropdown */}
        <div className="flex items-center gap-4">
          <img src={mebooksBook} alt="MeBooks Logo" className="w-10 h-10 flex-shrink-0" />
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setIsCatalogDropdownOpen(prev => !prev)}
              className="flex items-center gap-2 text-white text-left"
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
              <div className="absolute top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20">
                <ul className="p-1 text-white max-h-96 overflow-y-auto">
                  <li>
                    <button onClick={() => handleSelectSource('library')} className={`w-full text-left px-3 py-2 text-sm rounded-md ${!isBrowsingOpds ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>
                      My Library
                    </button>
                  </li>
                  {(catalogs.length > 0 || registries.length > 0) && <li className="my-1 border-t border-slate-700" />}

                  {catalogs.length > 0 && <>
                    <li className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase">Catalogs</li>
                    {catalogs.map(catalog => (
                      <li key={catalog.id}>
                        <button onClick={() => handleSelectSource(catalog)} className={`w-full text-left px-3 py-2 text-sm rounded-md truncate ${isBrowsingOpds && activeOpdsSource?.id === catalog.id ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>
                          {catalog.name}
                        </button>
                      </li>
                    ))}
                  </>}

                  {registries.length > 0 && <>
                    <li className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase">Registries</li>
                    {registries.map(registry => (
                      <li key={registry.id}>
                        <button onClick={() => handleSelectSource(registry)} className={`w-full text-left px-3 py-2 text-sm rounded-md truncate ${isBrowsingOpds && activeOpdsSource?.id === registry.id ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>
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
              className="cursor-pointer bg-slate-900/80 hover:bg-slate-800 text-slate-200 p-2 rounded-md inline-flex items-center transition-colors duration-200 h-[36px] w-[36px] justify-center border border-slate-700/80"
              aria-label="Open main menu"
            >
              <ListIcon className="w-4 h-4" />
            </button>
            {isSettingsMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900/95 border border-slate-700/80 rounded-md shadow-xl z-20 overflow-hidden backdrop-blur-sm">
                <div className="px-3 py-2.5 border-b border-slate-700/60 bg-slate-800/50">
                  {isLoggedIn && user ? (
                    <div className="flex items-center gap-2.5">
                      <img
                        src={user.picture}
                        alt={`${user.name} profile`}
                        className="w-8 h-8 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-100 truncate leading-tight">{user.name}</p>
                        <p className="text-[11px] text-slate-500 truncate leading-tight">{user.email}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] font-medium text-slate-300">Browsing locally</p>
                  )}
                  <p className={`mt-2 text-[11px] leading-tight ${syncSummaryTone}`}>{syncSummary}</p>
                </div>
                <ul className="p-1.5 text-white">
                  {!isBrowsingOpds && (
                    <li>
                      <ImportButton
                        isLoading={importStatus.isLoading}
                        onFileChange={handleFileChange}
                        onActivate={() => setIsSettingsMenuOpen(false)}
                        alwaysShowLabel={true}
                        className="w-full justify-start rounded-sm bg-transparent hover:bg-slate-800/80 text-slate-100 font-medium px-2.5 py-2 border-0 text-[13px]"
                      />
                    </li>
                  )}
                  {!isBrowsingOpds && <li className="my-1 border-t border-slate-700/40" />}
                  <li>
                    <button
                      onClick={() => {
                        setIsManageCatalogsOpen(true);
                        setIsSettingsMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-2 text-[13px] rounded-sm hover:bg-slate-800/80 text-slate-200 block"
                    >
                      Manage Sources
                    </button>
                  </li>
                  <li className="my-1 border-t border-slate-700/40" />
                  <li>
                    <button
                      onClick={() => {
                        onOpenLocalStorageModal();
                        setIsSettingsMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-2 text-[13px] rounded-sm hover:bg-slate-800/80 text-slate-200 block"
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
                      className="w-full text-left px-2.5 py-2 text-[13px] rounded-sm hover:bg-slate-800/80 text-slate-200 block"
                    >
                      Cloud Sync
                    </button>
                  </li>
                  <li className="my-1 border-t border-slate-700/40" />
                  <li>
                    <button
                      onClick={() => {
                        onShowAbout();
                        setIsSettingsMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-2 text-[13px] rounded-sm hover:bg-slate-800/80 text-slate-200 block"
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
            rootLevelCollections={rootLevelCollections}
            setRootLevelCollections={setRootLevelCollections}
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
