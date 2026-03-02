import React from 'react';

import {
  LocalStorageModal,
  NetworkDebugModal,
  OpdsCredentialsModal,
  SettingsModal,
  ShortcutHelpModal,
} from '..';
import { getCachedAuthDocumentForUrl } from '../../services';
import type { CredentialPrompt, DriveSnapshot } from '../../types';

interface GlobalModalsProps {
  // Cloud sync modal
  isCloudSyncModalOpen: boolean;
  onCloseCloudSyncModal: () => void;
  onUploadToDrive: () => Promise<void>;
  onDownloadFromDrive: () => Promise<void>;
  driveSnapshots: DriveSnapshot[];
  selectedSnapshotId: string;
  onSelectSnapshotId: (snapshotId: string) => void;
  onRefreshSnapshots: () => Promise<void>;
  isLoadingSnapshots: boolean;
  syncStatus: {
    state: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
  };
  setSyncStatus: React.Dispatch<React.SetStateAction<{
    state: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
  }>>;

  // Local storage modal
  isLocalStorageModalOpen: boolean;
  onCloseLocalStorageModal: () => void;

  // OPDS credentials modal
  credentialPrompt: CredentialPrompt;
  onCloseCredentialPrompt: () => void;
  onCredentialSubmit: (username: string, password: string, save: boolean) => Promise<void>;
  onOpenAuthLink: (href: string) => void;
  onRetryAfterProviderLogin: () => Promise<void>;

  // Network debug modal
  showNetworkDebug: boolean;
  onCloseNetworkDebug: () => void;
  onOpenNetworkDebug: () => void;

  // Shortcut help modal
  isShortcutHelpOpen: boolean;
  onCloseShortcutHelp: () => void;
}

/**
 * GlobalModals component renders all global modal dialogs.
 * This includes sync settings, credentials, network debug, etc.
 */
export const GlobalModals: React.FC<GlobalModalsProps> = ({
  isCloudSyncModalOpen,
  onCloseCloudSyncModal,
  onUploadToDrive,
  onDownloadFromDrive,
  driveSnapshots,
  selectedSnapshotId,
  onSelectSnapshotId,
  onRefreshSnapshots,
  isLoadingSnapshots,
  syncStatus,
  setSyncStatus,
  isLocalStorageModalOpen,
  onCloseLocalStorageModal,
  credentialPrompt,
  onCloseCredentialPrompt,
  onCredentialSubmit,
  onOpenAuthLink,
  onRetryAfterProviderLogin,
  showNetworkDebug,
  onCloseNetworkDebug,
  onOpenNetworkDebug,
  isShortcutHelpOpen,
  onCloseShortcutHelp,
}) => {
  const effectiveAuthDocument = credentialPrompt.authDocument
    || (credentialPrompt.pendingHref ? getCachedAuthDocumentForUrl(credentialPrompt.pendingHref) : null);
  const isPalaceCredentialPrompt = (() => {
    const target = credentialPrompt.pendingHref || credentialPrompt.host || '';
    try {
      const host = target.includes('://') ? new URL(target).hostname : target;
      const normalizedHost = host.toLowerCase();
      return normalizedHost.endsWith('palace.io')
        || normalizedHost.endsWith('palaceproject.io')
        || normalizedHost.endsWith('thepalaceproject.org')
        || normalizedHost.endsWith('.palace.io')
        || normalizedHost.endsWith('.thepalaceproject.org');
    } catch {
      return false;
    }
  })();

  return (
    <>
      <SettingsModal
        isOpen={isCloudSyncModalOpen}
        onClose={onCloseCloudSyncModal}
        onUploadToDrive={onUploadToDrive}
        onDownloadFromDrive={onDownloadFromDrive}
        driveSnapshots={driveSnapshots}
        selectedSnapshotId={selectedSnapshotId}
        onSelectSnapshotId={onSelectSnapshotId}
        onRefreshSnapshots={onRefreshSnapshots}
        isLoadingSnapshots={isLoadingSnapshots}
        syncStatus={syncStatus}
        setSyncStatus={setSyncStatus}
      />

      <LocalStorageModal
        isOpen={isLocalStorageModalOpen}
        onClose={onCloseLocalStorageModal}
      />

      <OpdsCredentialsModal
        isOpen={credentialPrompt.isOpen}
        host={credentialPrompt.host}
        authDocument={effectiveAuthDocument}
        onClose={onCloseCredentialPrompt}
        onSubmit={onCredentialSubmit}
        onOpenAuthLink={onOpenAuthLink}
        onRetry={onRetryAfterProviderLogin}
        probeUrl={credentialPrompt.pendingHref}
        usernameLabel={isPalaceCredentialPrompt && !effectiveAuthDocument ? 'Library Card / Barcode' : undefined}
        passwordLabel={isPalaceCredentialPrompt && !effectiveAuthDocument ? 'PIN' : undefined}
        usernamePlaceholder={isPalaceCredentialPrompt && !effectiveAuthDocument ? 'Library card or barcode' : undefined}
        passwordPlaceholder={isPalaceCredentialPrompt && !effectiveAuthDocument ? 'PIN' : undefined}
        descriptionOverride={isPalaceCredentialPrompt && !effectiveAuthDocument
          ? `Enter your library card and PIN for ${credentialPrompt.host} to continue.`
          : undefined}
        saveLabel={isPalaceCredentialPrompt ? 'Save credential for this Palace catalog' : undefined}
      />

      <NetworkDebugModal
        isOpen={showNetworkDebug}
        onClose={onCloseNetworkDebug}
      />

      <ShortcutHelpModal
        isOpen={isShortcutHelpOpen}
        onClose={onCloseShortcutHelp}
        activeReader={null}
      />

      {/* Debug floating button (visible only in debug mode) */}
      {typeof window !== 'undefined' && (window as any).__MEBOOKS_DEBUG__ && (
        <div className="fixed right-3 bottom-3 z-[60]">
          <button
            onClick={onOpenNetworkDebug}
            className="px-3 py-2 bg-yellow-400 rounded shadow"
          >
            Network Debug
          </button>
        </div>
      )}
    </>
  );
};
