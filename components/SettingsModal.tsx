import React from 'react';

import { useAuth } from '../contexts/AuthContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { DriveSnapshot } from '../domain/sync/types';

import { CloseIcon, DownloadIcon, UploadIcon } from './icons';
import Spinner from './Spinner';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadToDrive: () => void;
  onDownloadFromDrive: () => void;
  driveSnapshots: DriveSnapshot[];
  selectedSnapshotId: string;
  onSelectSnapshotId: (snapshotId: string) => void;
  onRefreshSnapshots: () => void;
  isLoadingSnapshots: boolean;
  syncStatus: {
    state: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
  };
  setSyncStatus: React.Dispatch<React.SetStateAction<{
    state: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
  }>>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onUploadToDrive,
  onDownloadFromDrive,
  driveSnapshots,
  selectedSnapshotId,
  onSelectSnapshotId,
  onRefreshSnapshots,
  isLoadingSnapshots,
  syncStatus,
  setSyncStatus,
}) => {
  const { user, isLoggedIn, reauthorizeDrive, signOut, isInitialized, authStatus, authError } = useAuth();

  const handleClose = () => {
    if (syncStatus.state !== 'syncing') {
      setSyncStatus({ state: 'idle', message: '' });
      onClose();
    }
  };

  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen,
    onEscape: handleClose,
  });

  if (!isOpen) return null;

  const lastSyncDate = localStorage.getItem('ebook-reader-last-sync');
  const lastSyncString = lastSyncDate ? new Date(lastSyncDate).toLocaleString() : 'Never';
  const isSyncing = syncStatus.state === 'syncing';

  const syncTone = syncStatus.state === 'error'
    ? 'theme-danger'
    : syncStatus.state === 'success'
      ? 'theme-success'
      : syncStatus.state === 'syncing'
        ? 'theme-info'
        : 'theme-surface-elevated theme-border theme-text-secondary';
  const syncSummary = syncStatus.state === 'idle' ? `Last synced: ${lastSyncString}` : syncStatus.message;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={handleClose} aria-modal="true" role="dialog">
      <div ref={modalRef} className="theme-surface-elevated theme-border theme-text-primary w-full max-w-lg rounded-lg border p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-sky-300">Cloud Sync</h2>
          <button onClick={handleClose} className="theme-hover-surface rounded-full p-2 transition-colors" aria-label="Close" disabled={isSyncing}>
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/50 p-4 rounded-lg theme-surface-muted">
            <h3 className="theme-text-primary mb-4 text-lg font-semibold">Account & Sync</h3>
            {isLoggedIn && user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <img src={user.picture} alt="User" className="w-12 h-12 rounded-full" />
                  <div className="flex-grow">
                    <p className="font-semibold">{user.name}</p>
                    <p className="theme-text-secondary text-sm">{user.email}</p>
                  </div>
                  <button onClick={reauthorizeDrive} className="py-2 px-3 rounded-md bg-sky-700 hover:bg-sky-600 transition-colors font-semibold text-xs">
                    Refresh Drive Access
                  </button>
                  <button onClick={signOut} className="theme-button-neutral theme-hover-surface rounded-md px-4 py-2 text-sm font-semibold transition-colors">
                    Sign Out
                  </button>
                </div>
                <div className={`rounded-md border px-3 py-2 text-xs ${syncTone}`}>
                  {syncSummary}
                </div>
                {authError && (
                  <p className="theme-text-warning text-xs" role="status">{authError}</p>
                )}
              </div>
            ) : (
              <div>
                <p className="theme-text-secondary mb-3 text-sm">Use the main menu&apos;s Log In action to connect your Google account, then return here for manual uploads and downloads.</p>
                {authStatus === 'not_configured' && (
                  <p className="theme-text-warning mb-3 text-xs" role="status">Google sync is not configured for this deployment. Set `VITE_GOOGLE_CLIENT_ID` and redeploy.</p>
                )}
                {(!isInitialized || authStatus === 'initializing') && (
                  <p className="theme-text-secondary mb-3 text-xs" role="status">Google sign-in is still initializing.</p>
                )}
                {authStatus === 'error' && authError && (
                  <p className="theme-text-warning mb-3 text-xs" role="status">{authError}</p>
                )}
              </div>
            )}
          </div>

          {isLoggedIn && (
            <div className="bg-slate-900/50 p-4 rounded-lg theme-surface-muted">
              <h3 className="theme-text-primary mb-2 text-lg font-semibold">Google Drive Sync</h3>
              <p className="theme-text-muted mb-4 text-xs">Last synced: {lastSyncString}</p>

              <div className="theme-surface-elevated theme-border mb-4 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="theme-text-secondary text-xs font-semibold uppercase">Restore Point</p>
                  <button
                    onClick={onRefreshSnapshots}
                    disabled={isSyncing || isLoadingSnapshots}
                    className="theme-button-neutral theme-hover-surface rounded px-2 py-1 text-xs disabled:opacity-60"
                  >
                    {isLoadingSnapshots ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <select
                  value={selectedSnapshotId}
                  onChange={(e) => onSelectSnapshotId(e.target.value)}
                  disabled={isSyncing || isLoadingSnapshots || driveSnapshots.length === 0}
                  className="theme-input w-full rounded border p-2 text-sm"
                >
                  {driveSnapshots.length === 0 ? (
                    <option value="">No snapshots found yet</option>
                  ) : (
                    driveSnapshots.map((snapshot) => (
                      <option key={snapshot.id} value={snapshot.id}>
                        {snapshot.isLatest ? '[Latest] ' : ''}{snapshot.name}
                      </option>
                    ))
                  )}
                </select>
                <p className="theme-text-secondary mt-2 text-xs">
                  Select which cloud snapshot to use when downloading. Upload creates a new timestamped snapshot automatically.
                </p>
              </div>

              {syncStatus.state !== 'idle' ? (
                <div className="theme-surface-elevated rounded-md p-4 text-center">
                  {isSyncing && <Spinner text={syncStatus.message} />}
                  {syncStatus.state === 'success' && <p className="theme-text-success">{syncStatus.message}</p>}
                  {syncStatus.state === 'error' && <p className="theme-text-danger">{syncStatus.message}</p>}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={onUploadToDrive} className="theme-button-neutral theme-hover-surface flex flex-col items-center justify-center gap-2 rounded-md p-4 transition-colors disabled:opacity-50" disabled={isSyncing}>
                    <UploadIcon className="w-6 h-6 text-sky-400" />
                    <span className="font-semibold">Upload to Drive</span>
                    <span className="theme-text-secondary text-center text-xs">Save your local library to the cloud. This will overwrite any existing data in Drive.</span>
                  </button>
                  <button onClick={onDownloadFromDrive} className="theme-button-neutral theme-hover-surface flex flex-col items-center justify-center gap-2 rounded-md p-4 transition-colors disabled:opacity-50" disabled={isSyncing}>
                    <DownloadIcon className="w-6 h-6 text-sky-400" />
                    <span className="font-semibold">Download from Drive</span>
                    <span className="theme-text-secondary text-center text-xs">Replace your local library with the one from Drive. Local changes will be lost.</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
