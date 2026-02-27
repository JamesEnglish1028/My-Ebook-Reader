import React from 'react';

import {
    AboutPage,
    BookDetailView,
    ErrorBoundary,
    ReaderView,
} from '..';
import type {
    BookMetadata,
    BookRecord,
    Catalog,
    CatalogBook,
    CatalogRegistry,
    CoverAnimationData,
} from '../../types';
import type { BookDetailMetadata } from '../BookDetailView';
import LibraryView from '../library/LibraryView';
import PdfReaderView from '../PdfReaderView';


export interface ViewRendererProps {
  libraryRefreshFlag: number;
  currentView: 'library' | 'reader' | 'pdfReader' | 'bookDetail' | 'about';

  // Reader view props
  selectedBookId: number | null;
  coverAnimationData: CoverAnimationData | null;
  onCloseReader: () => void;

  // Book detail view props
  detailViewData: {
    book: BookDetailMetadata;
    source: 'library' | 'catalog';
    catalogName?: string;
  } | null;
  onReturnToLibrary: () => void;
  onReadBook: (id: number, animationData: CoverAnimationData, format?: string) => void;
  onImportFromCatalog: (book: CatalogBook, catalogName?: string) => Promise<{ success: boolean; bookRecord?: BookRecord; existingBook?: BookRecord }>;

  // Library view props
  syncStatus: {
    state: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
  };
  onOpenBook: (id: number, animationData: CoverAnimationData, format?: string) => void;
  onShowBookDetail: (book: BookMetadata | CatalogBook, source: 'library' | 'catalog', catalogName?: string) => void;
  userCitationFormat: 'apa' | 'mla' | 'chicago';
  processAndSaveBook: (
    bookData: ArrayBuffer,
    fileName?: string,
    authorName?: string,
    source?: 'file' | 'catalog',
    providerName?: string,
    providerId?: string,
    format?: string,
    coverImageUrl?: string | null,
    catalogBookMeta?: Partial<CatalogBook>,
  ) => Promise<{ success: boolean; bookRecord?: BookRecord; existingBook?: BookRecord }>;
  activeOpdsSource: Catalog | CatalogRegistry | null;
  setActiveOpdsSource: (source: Catalog | CatalogRegistry | null) => void;
  catalogNavPath: { name: string; url: string }[];
  setCatalogNavPath: (path: { name: string; url: string }[]) => void;
  onOpenCloudSyncModal: () => void;
  onOpenLocalStorageModal: () => void;
  onShowAbout: () => void;

  // Import status (shared between views)
  importStatus: {
    isLoading: boolean;
    message: string;
    error: string | null;
  };
  setImportStatus: React.Dispatch<React.SetStateAction<{
    isLoading: boolean;
    message: string;
    error: string | null;
  }>>;
}

/**
 * ViewRenderer component handles the routing/view switching logic for the app.
 * It renders the appropriate view based on currentView state and passes necessary props.
 */
export const ViewRenderer: React.FC<ViewRendererProps> = (props) => {
  const {
    currentView,
    selectedBookId,
    coverAnimationData,
    onCloseReader,
    detailViewData,
    onReturnToLibrary,
    onImportFromCatalog,
    onOpenBook,
    onShowBookDetail,
    syncStatus,
    processAndSaveBook,
    activeOpdsSource,
    setActiveOpdsSource,
    catalogNavPath,
    setCatalogNavPath,
    onOpenCloudSyncModal,
    onOpenLocalStorageModal,
    onShowAbout,
    importStatus,
    setImportStatus,
    libraryRefreshFlag,
    userCitationFormat,
  } = props;

  const [view, setView] = React.useState(currentView);
  const [readerBookId, setReaderBookId] = React.useState<number | null>(selectedBookId);
  const [readerAnimationData, setReaderAnimationData] = React.useState<CoverAnimationData | null>(coverAnimationData);
  // Store which reader to use: 'reader' (EPUB) or 'pdfReader'
  const [readerType, setReaderType] = React.useState<'reader' | 'pdfReader'>('reader');

  // Patch: Enhanced onReadBook to select reader based on mediaType/format
  const handleReadBook = React.useCallback((book: any, animationData?: CoverAnimationData) => {
    // Prefer mediaType if available
    const mediaType = book.mediaType || book.acquisitionMediaType || '';
    const format = (book.format || '').toUpperCase();
    let type: 'reader' | 'pdfReader' = 'reader';
    if (mediaType.includes('pdf') || format === 'PDF') {
      type = 'pdfReader';
    } else if (mediaType.includes('epub') || format === 'EPUB') {
      type = 'reader';
    }
    setReaderBookId(book.id);
    setReaderAnimationData(animationData || null);
    setReaderType(type);
    setView(type);
  }, []);

  // Keep view state in sync with parent prop
  React.useEffect(() => {
    setView(currentView);
  }, [currentView]);

  // Keep selectedBookId in sync
  React.useEffect(() => {
    setReaderBookId(selectedBookId);
  }, [selectedBookId]);

  // Keep animationData in sync
  React.useEffect(() => {
    setReaderAnimationData(coverAnimationData);
  }, [coverAnimationData]);

  switch (view) {

    case 'reader':
      return readerBookId !== null ? (
        <ErrorBoundary
          onReset={onCloseReader}
          fallbackMessage="There was an error while trying to display this book. Returning to the library."
        >
          <ReaderView
            bookId={readerBookId}
            onClose={onCloseReader}
            animationData={readerAnimationData}
          />
        </ErrorBoundary>
      ) : null;

    case 'pdfReader':
      return readerBookId !== null ? (
        <ErrorBoundary
          onReset={onCloseReader}
          fallbackMessage="There was an error while trying to display this PDF. Returning to the library."
        >
          <PdfReaderView
            bookId={readerBookId}
            onClose={onCloseReader}
          />
        </ErrorBoundary>
      ) : null;

    case 'bookDetail':
      return detailViewData ? (
        <ErrorBoundary
          onReset={onReturnToLibrary}
          fallbackMessage="There was an error showing the book details. Returning to the library."
        >
          <BookDetailView
            book={detailViewData.book}
            source={detailViewData.source as 'library' | 'catalog'}
            catalogName={detailViewData.catalogName}
            onBack={onReturnToLibrary}
            onReadBook={handleReadBook}
            onImportFromCatalog={onImportFromCatalog}
            importStatus={importStatus}
            setImportStatus={setImportStatus}
            userCitationFormat={userCitationFormat as 'apa' | 'mla' | 'chicago'}
          />
        </ErrorBoundary>
      ) : null;

    case 'about':
      return <AboutPage onBack={onReturnToLibrary} />;

    case 'library':
    default:
      return (
        <ErrorBoundary
          onReset={() => window.location.reload()}
          fallbackMessage="There was a critical error in the library. Please try reloading the application."
        >
          <LibraryView
            onOpenBook={onOpenBook}
            onShowBookDetail={onShowBookDetail}
            processAndSaveBook={processAndSaveBook}
            importStatus={importStatus}
            setImportStatus={setImportStatus}
            activeOpdsSource={activeOpdsSource}
            setActiveOpdsSource={setActiveOpdsSource}
            catalogNavPath={catalogNavPath}
            setCatalogNavPath={setCatalogNavPath}
            onOpenCloudSyncModal={onOpenCloudSyncModal}
            onOpenLocalStorageModal={onOpenLocalStorageModal}
            onShowAbout={onShowAbout}
            libraryRefreshFlag={libraryRefreshFlag}
            syncStatus={syncStatus}
          />
        </ErrorBoundary>
      );
  }
};
