import { useCallback, useState } from 'react';

import { db, downloadLibraryFromDrive, listDriveSnapshots, logger, uploadLibraryToDrive } from '../../services';
import type {
  Bookmark,
  BookRecord,
  Catalog,
  Citation,
  DriveSnapshot,
  ReaderSettings,
  SyncPayload,
} from '../../types';

export interface SyncStatusState {
  state: 'idle' | 'syncing' | 'success' | 'error';
  message: string;
}

interface UseSyncCoordinatorOptions {
  tokenClient: unknown;
  confirm: (options: { message: string; title: string; confirmLabel: string; cancelLabel: string }) => Promise<boolean>;
}

const initialSyncStatus: SyncStatusState = { state: 'idle', message: '' };

export const useSyncCoordinator = ({ tokenClient, confirm }: UseSyncCoordinatorOptions) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>(initialSyncStatus);
  const [driveSnapshots, setDriveSnapshots] = useState<DriveSnapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);

  const gatherDataForUpload = useCallback(async (): Promise<{ payload: SyncPayload; booksWithData: BookRecord[] }> => {
    const booksWithData = await db.getAllBooks();
    const library = booksWithData.map((book) => {
      const meta = { ...book } as Omit<BookRecord, 'epubData'> & { epubData?: ArrayBuffer };
      delete meta.epubData;
      return meta;
    });

    const catalogs: Catalog[] = JSON.parse(localStorage.getItem('ebook-catalogs') || '[]');
    const settings: ReaderSettings = JSON.parse(localStorage.getItem('ebook-reader-settings-global') || '{}');

    const bookmarks: Record<number, Bookmark[]> = {};
    const citations: Record<number, Citation[]> = {};
    const positions: Record<number, string | null> = {};

    booksWithData.forEach((book) => {
      if (book.id) {
        bookmarks[book.id] = JSON.parse(localStorage.getItem(`ebook-reader-bookmarks-${book.id}`) || '[]');
        citations[book.id] = JSON.parse(localStorage.getItem(`ebook-reader-citations-${book.id}`) || '[]');
        positions[book.id] = localStorage.getItem(`ebook-reader-pos-${book.id}`);
      }
    });

    return {
      payload: { library, catalogs, bookmarks, citations, positions, settings },
      booksWithData,
    };
  }, []);

  const refreshDriveSnapshots = useCallback(async () => {
    if (!tokenClient) {
      setDriveSnapshots([]);
      setSelectedSnapshotId('');
      return;
    }

    setIsLoadingSnapshots(true);
    try {
      const snapshots = await listDriveSnapshots();
      setDriveSnapshots(snapshots);

      const latest = snapshots.find((s) => s.isLatest);
      if (!selectedSnapshotId && latest?.id) {
        setSelectedSnapshotId(latest.id);
      } else if (selectedSnapshotId && !snapshots.some((s) => s.id === selectedSnapshotId)) {
        setSelectedSnapshotId(latest?.id || '');
      }
    } catch (error) {
      logger.warn('Failed to load Drive snapshots', error);
      setDriveSnapshots([]);
      setSelectedSnapshotId('');
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, [selectedSnapshotId, tokenClient]);

  const handleUploadToDrive = useCallback(async () => {
    if (!tokenClient) return;
    setSyncStatus({ state: 'syncing', message: 'Gathering local data...' });
    try {
      const { payload, booksWithData } = await gatherDataForUpload();
      setSyncStatus({ state: 'syncing', message: 'Uploading to Google Drive... This may take a while.' });
      await uploadLibraryToDrive(payload, booksWithData, (progressMsg) => {
        setSyncStatus({ state: 'syncing', message: progressMsg });
      });
      localStorage.setItem('ebook-reader-last-sync', new Date().toISOString());
      await refreshDriveSnapshots();
      setSyncStatus({ state: 'success', message: 'Library successfully uploaded!' });
    } catch (error) {
      logger.error('Upload failed:', error);
      setSyncStatus({ state: 'error', message: error instanceof Error ? error.message : 'An unknown error occurred.' });
    }
  }, [gatherDataForUpload, refreshDriveSnapshots, tokenClient]);

  const handleDownloadFromDrive = useCallback(async () => {
    if (!tokenClient) return;
    const confirmed = await confirm({
      message: 'DANGER: This will replace your entire local library with the version from Google Drive.\n\nAny local books or changes not uploaded to Drive will be permanently lost.\n\nAre you absolutely sure you want to continue?',
      title: 'Dangerous Operation',
      confirmLabel: 'Yes, replace',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    setSyncStatus({ state: 'syncing', message: 'Downloading from Google Drive...' });
    try {
      const downloadedData = await downloadLibraryFromDrive((progressMsg) => {
        setSyncStatus({ state: 'syncing', message: progressMsg });
      }, selectedSnapshotId || undefined);

      if (!downloadedData) {
        throw new Error('No data found in Google Drive.');
      }

      setSyncStatus({ state: 'syncing', message: 'Clearing local library...' });
      await db.clearAllBooks();

      Object.keys(localStorage)
        .filter((key) => key.startsWith('ebook-reader-'))
        .forEach((key) => localStorage.removeItem(key));

      setSyncStatus({ state: 'syncing', message: 'Importing downloaded library...' });
      localStorage.setItem('ebook-catalogs', JSON.stringify(downloadedData.payload.catalogs || []));
      localStorage.setItem('ebook-reader-settings-global', JSON.stringify(downloadedData.payload.settings || {}));

      for (const book of downloadedData.booksWithData) {
        await db.saveBook(book);
        if (book.id) {
          const bookId = book.id;
          if (downloadedData.payload.bookmarks[bookId]) {
            localStorage.setItem(`ebook-reader-bookmarks-${bookId}`, JSON.stringify(downloadedData.payload.bookmarks[bookId]));
          }
          if (downloadedData.payload.citations[bookId]) {
            localStorage.setItem(`ebook-reader-citations-${bookId}`, JSON.stringify(downloadedData.payload.citations[bookId]));
          }
          const position = downloadedData.payload.positions[bookId];
          if (position) {
            localStorage.setItem(`ebook-reader-pos-${bookId}`, position);
          }
        }
      }

      localStorage.setItem('ebook-reader-last-sync', new Date().toISOString());
      setSyncStatus({ state: 'success', message: 'Library successfully downloaded! Reloading app...' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      logger.error('Download failed:', error);
      setSyncStatus({ state: 'error', message: error instanceof Error ? error.message : 'An unknown error occurred.' });
    }
  }, [confirm, selectedSnapshotId, tokenClient]);

  return {
    syncStatus,
    setSyncStatus,
    driveSnapshots,
    selectedSnapshotId,
    setSelectedSnapshotId,
    isLoadingSnapshots,
    refreshDriveSnapshots,
    handleUploadToDrive,
    handleDownloadFromDrive,
  };
};
