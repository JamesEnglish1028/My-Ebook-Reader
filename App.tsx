import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, QueryErrorResetBoundary } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import {
  ErrorBoundary,
  ScreenReaderAnnouncer,
  SplashScreen,
  useConfirm,
  useToast,
} from './components';
import { GlobalModals, ViewRenderer } from './components/app';
import PdfReaderView from './components/PdfReaderView';
import { useAuthAcquisitionCoordinator } from './components/app/useAuthAcquisitionCoordinator';
import { useImportCoordinator } from './components/app/useImportCoordinator';
import { useSyncCoordinator } from './components/app/useSyncCoordinator';
import { useAuth } from './contexts/AuthContext';
import { useCatalogs, useGlobalShortcuts, useUiTheme } from './hooks';
import { db, logger } from './services';
import type {
  BookMetadata,
  Catalog,
  CatalogBook,
  CatalogRegistry,
  CoverAnimationData,
} from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: false,
      throwOnError: false,
    },
    mutations: {
      retry: 1,
      throwOnError: false,
    },
  },
});

const AppInner: React.FC = () => {
  const { addCatalog } = useCatalogs();
  const { uiTheme, resolvedTheme } = useUiTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { tokenClient } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [userCitationFormat, setUserCitationFormat] = useState<'apa' | 'mla'>(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('ebook-reader-settings-global') || '{}');
      return settings.citationFormat || 'apa';
    } catch {
      return 'apa';
    }
  });

  useEffect(() => {
    const handler = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('ebook-reader-settings-global') || '{}');
        setUserCitationFormat(settings.citationFormat || 'apa');
      } catch {
        // no-op
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const [currentView, setCurrentView] = useState<'library' | 'reader' | 'pdfReader' | 'bookDetail' | 'about'>('library');
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [coverAnimationData, setCoverAnimationData] = useState<CoverAnimationData | null>(null);
  const [activeOpdsSource, setActiveOpdsSource] = useState<Catalog | CatalogRegistry | null>(null);
  const [catalogNavPath, setCatalogNavPath] = useState<{ name: string; url: string }[]>([]);
  const [showSplash, setShowSplash] = useState(true);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [isLocalStorageModalOpen, setIsLocalStorageModalOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);

  const [detailViewData, setDetailViewData] = useState<{
    book: BookMetadata | CatalogBook;
    source: 'library' | 'catalog';
    catalogName?: string;
  } | null>(null);

  const handleReturnToLibrary = useCallback(() => {
    setDetailViewData(null);
    setCurrentView('library');
  }, []);

  const {
    importStatus,
    setImportStatus,
    libraryRefreshFlag,
    processAndSaveBook,
  } = useImportCoordinator({ onCatalogImportSuccess: handleReturnToLibrary });

  const {
    credentialPrompt,
    setCredentialPrompt,
    handleImportFromCatalog,
    handleCredentialSubmit,
    handleOpenAuthLink,
    handleRetryAfterProviderLogin,
    showNetworkDebug,
    setShowNetworkDebug,
  } = useAuthAcquisitionCoordinator({
    processAndSaveBook,
    setImportStatus,
    setActiveOpdsSource,
    setCurrentView,
    pushToast: toast.pushToast,
  });

  const {
    syncStatus,
    setSyncStatus,
    driveSnapshots,
    selectedSnapshotId,
    setSelectedSnapshotId,
    isLoadingSnapshots,
    refreshDriveSnapshots,
    handleUploadToDrive,
    handleDownloadFromDrive,
  } = useSyncCoordinator({ tokenClient, confirm });

  useEffect(() => {
    if (isCloudSyncModalOpen) {
      void refreshDriveSnapshots();
    }
  }, [isCloudSyncModalOpen, refreshDriveSnapshots]);

  useEffect(() => {
    db.init();
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useGlobalShortcuts({
    shortcuts: [
      {
        key: '?',
        description: 'Show keyboard shortcuts',
        category: 'global',
        action: () => setIsShortcutHelpOpen(true),
      },
      {
        key: 'Escape',
        description: 'Close active modal or return to library',
        category: 'global',
        action: () => {
          if (isShortcutHelpOpen) {
            setIsShortcutHelpOpen(false);
          } else if (isCloudSyncModalOpen) {
            setIsCloudSyncModalOpen(false);
          } else if (isLocalStorageModalOpen) {
            setIsLocalStorageModalOpen(false);
          } else if (credentialPrompt.isOpen) {
            setCredentialPrompt((prev) => ({ ...prev, isOpen: false }));
          } else if (currentView === 'bookDetail') {
            setCurrentView('library');
          }
        },
      },
    ],
    enabled: !showSplash,
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const auto = params.get('autoOpen');
    if (auto === 'first') {
      (async () => {
        try {
          const all = await db.getAllBooks();
          if (!all || all.length === 0) return;
          const first = all[0];
          if (!first || !first.id) return;
          const format = first.format || 'EPUB';
          if (format === 'PDF') {
            navigate(`/pdf/${first.id}`);
          } else {
            setSelectedBookId(first.id as number);
            setCurrentView('reader');
          }
        } catch (e) {
          logger.warn('Auto-open failed', e);
        }
      })();
    }
  }, [location.search, navigate]);

  const importCatalog = useCallback((importUrl: string, catalogName: string) => {
    try {
      addCatalog(catalogName, importUrl, '2');
      toast.pushToast(`Successfully added catalog: ${catalogName}`, 4000);
      logger.info('[App] Auto-imported OPDS catalog from registry', { importUrl, catalogName });
      setCurrentView('library');
      window.focus();
      return true;
    } catch (error) {
      toast.pushToast(`Failed to add catalog: ${catalogName}`, 6000);
      logger.error('[App] Failed to import OPDS catalog from registry', { importUrl, catalogName, error });
      return false;
    }
  }, [addCatalog, toast]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const importUrl = params.get('import');
    const catalogName = params.get('name');

    if (importUrl && catalogName) {
      importCatalog(importUrl, catalogName);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('import');
      newUrl.searchParams.delete('name');
      window.history.replaceState({}, document.title, newUrl.toString());
    }
  }, [location.search, importCatalog]);

  useEffect(() => {
    const handleStorageMessage = (event: StorageEvent) => {
      if (event.key === 'mebooks-import-catalog' && event.newValue) {
        try {
          const { importUrl, catalogName, timestamp } = JSON.parse(event.newValue);
          if (Date.now() - timestamp < 5000) {
            const success = importCatalog(importUrl, catalogName);
            localStorage.setItem('mebooks-import-response', JSON.stringify({
              success,
              catalogName,
              timestamp: Date.now(),
            }));
            localStorage.removeItem('mebooks-import-catalog');
          }
        } catch (error) {
          logger.error('[App] Failed to process cross-tab import message', { error });
        }
      }

      if (event.key === 'mebooks-ping' && event.newValue) {
        try {
          const { timestamp } = JSON.parse(event.newValue);
          if (Date.now() - timestamp < 2000) {
            localStorage.setItem('mebooks-pong', JSON.stringify({
              timestamp: Date.now(),
              version: '1.0.0',
            }));
            localStorage.removeItem('mebooks-ping');
          }
        } catch (error) {
          logger.error('[App] Failed to process ping message', { error });
        }
      }
    };

    window.addEventListener('storage', handleStorageMessage);
    return () => window.removeEventListener('storage', handleStorageMessage);
  }, [importCatalog]);

  const handleOpenBook = useCallback((id: number, animationData: CoverAnimationData, format: string = 'EPUB') => {
    setSelectedBookId(id);
    if (format === 'PDF') {
      setCoverAnimationData(null);
      navigate(`/pdf/${id}`);
    } else {
      setCoverAnimationData(animationData);
      setCurrentView('reader');
    }
  }, [navigate]);

  const handleCloseReader = useCallback(() => {
    setSelectedBookId(null);
    setCurrentView('library');
    setCoverAnimationData(null);
    navigate('/');
  }, [navigate]);

  const handleShowBookDetail = useCallback((book: BookMetadata | CatalogBook, source: 'library' | 'catalog', catalogName?: string) => {
    setDetailViewData({ book, source, catalogName });
    setCurrentView('bookDetail');
  }, []);

  const handleShowAbout = useCallback(() => {
    setCurrentView('about');
  }, []);

  return (
    <div
      className={`min-h-screen font-sans theme-shell ${resolvedTheme === 'light' ? 'bg-slate-50 text-slate-950' : 'bg-slate-900 text-white'}`}
      data-ui-theme={uiTheme}
      data-ui-theme-resolved={resolvedTheme}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-sky-500 focus:text-white focus:rounded-md focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>

      <SplashScreen isVisible={showSplash} />

      {!showSplash && (
        <main id="main-content">
          <ViewRenderer
            currentView={currentView}
            selectedBookId={selectedBookId}
            coverAnimationData={coverAnimationData}
            onCloseReader={handleCloseReader}
            detailViewData={detailViewData}
            onReturnToLibrary={handleReturnToLibrary}
            onReadBook={handleOpenBook}
            onImportFromCatalog={handleImportFromCatalog}
            onAutoBackupToDrive={handleUploadToDrive}
            onOpenBook={handleOpenBook}
            onShowBookDetail={handleShowBookDetail}
            syncStatus={syncStatus}
            processAndSaveBook={processAndSaveBook}
            activeOpdsSource={activeOpdsSource}
            setActiveOpdsSource={setActiveOpdsSource}
            catalogNavPath={catalogNavPath}
            setCatalogNavPath={setCatalogNavPath}
            onOpenCloudSyncModal={() => setIsCloudSyncModalOpen(true)}
            onOpenLocalStorageModal={() => setIsLocalStorageModalOpen(true)}
            onShowAbout={handleShowAbout}
            importStatus={importStatus}
            setImportStatus={setImportStatus}
            libraryRefreshFlag={libraryRefreshFlag}
            userCitationFormat={userCitationFormat}
          />
        </main>
      )}

      <GlobalModals
        isCloudSyncModalOpen={isCloudSyncModalOpen}
        onCloseCloudSyncModal={() => setIsCloudSyncModalOpen(false)}
        onUploadToDrive={handleUploadToDrive}
        onDownloadFromDrive={handleDownloadFromDrive}
        driveSnapshots={driveSnapshots}
        selectedSnapshotId={selectedSnapshotId}
        onSelectSnapshotId={setSelectedSnapshotId}
        onRefreshSnapshots={refreshDriveSnapshots}
        isLoadingSnapshots={isLoadingSnapshots}
        syncStatus={syncStatus}
        setSyncStatus={setSyncStatus}
        isLocalStorageModalOpen={isLocalStorageModalOpen}
        onCloseLocalStorageModal={() => setIsLocalStorageModalOpen(false)}
        credentialPrompt={credentialPrompt}
        onCloseCredentialPrompt={() => setCredentialPrompt({ isOpen: false, host: null, pendingHref: null, pendingBook: null, pendingCatalogName: undefined, authDocument: null })}
        onCredentialSubmit={handleCredentialSubmit}
        onOpenAuthLink={handleOpenAuthLink}
        onRetryAfterProviderLogin={handleRetryAfterProviderLogin}
        showNetworkDebug={showNetworkDebug}
        onCloseNetworkDebug={() => setShowNetworkDebug(false)}
        onOpenNetworkDebug={() => setShowNetworkDebug(true)}
        isShortcutHelpOpen={isShortcutHelpOpen}
        onCloseShortcutHelp={() => setIsShortcutHelpOpen(false)}
      />

      <ScreenReaderAnnouncer
        message={importStatus.isLoading ? importStatus.message : importStatus.error || null}
        politeness={importStatus.error ? 'assertive' : 'polite'}
      />
      <ScreenReaderAnnouncer
        message={syncStatus.state !== 'idle' ? syncStatus.message : null}
        politeness={syncStatus.state === 'error' ? 'assertive' : 'polite'}
      />
    </div>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <HashRouter>
          <Routes>
            <Route
              path="/pdf/:id"
              element={(
                <ErrorBoundary onReset={() => { reset(); window.location.replace('/'); }} fallbackMessage="There was an error loading the PDF viewer.">
                  <PdfReaderViewWrapper />
                </ErrorBoundary>
              )}
            />
            <Route
              path="/*"
              element={(
                <ErrorBoundary onReset={() => { reset(); window.location.reload(); }} fallbackMessage="There was an error loading the application.">
                  <AppInner />
                </ErrorBoundary>
              )}
            />
          </Routes>
        </HashRouter>
      )}
    </QueryErrorResetBoundary>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);

const PdfReaderViewWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <PdfReaderView onClose={() => navigate('/')} />;
};

export default App;
