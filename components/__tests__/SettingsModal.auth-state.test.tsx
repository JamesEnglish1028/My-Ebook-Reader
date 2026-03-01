import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../contexts/AuthContext';
import SettingsModal from '../SettingsModal';

vi.mock('../../hooks', () => ({
  useFocusTrap: () => React.createRef<HTMLDivElement>(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('SettingsModal auth states', () => {
  it('renders not-configured message and directs users to the main menu login', () => {
    const authValue: ReturnType<typeof useAuth> = {
      user: null,
      isLoggedIn: false,
      signIn: vi.fn(),
      reauthorizeDrive: vi.fn(),
      signOut: vi.fn(),
      tokenClient: null,
      isInitialized: true,
      authStatus: 'not_configured',
      authError: 'Set VITE_GOOGLE_CLIENT_ID',
    };
    vi.mocked(useAuth).mockReturnValue(authValue);

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onUploadToDrive={vi.fn()}
        onDownloadFromDrive={vi.fn()}
        driveSnapshots={[]}
        selectedSnapshotId=""
        onSelectSnapshotId={vi.fn()}
        onRefreshSnapshots={vi.fn()}
        isLoadingSnapshots={false}
        syncStatus={{ state: 'idle', message: '' }}
        setSyncStatus={vi.fn()}
      />,
    );

    expect(screen.getByText(/Google sync is not configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Use the main menu's Log In action/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Google Sync Not Configured/i })).not.toBeInTheDocument();
  });

  it('shows the auth error but no inline sign-in action when auth setup fails', () => {
    const authValue: ReturnType<typeof useAuth> = {
      user: null,
      isLoggedIn: false,
      signIn: vi.fn(),
      reauthorizeDrive: vi.fn(),
      signOut: vi.fn(),
      tokenClient: null,
      isInitialized: true,
      authStatus: 'error',
      authError: 'Google SDK timed out',
    };
    vi.mocked(useAuth).mockReturnValue(authValue);

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onUploadToDrive={vi.fn()}
        onDownloadFromDrive={vi.fn()}
        driveSnapshots={[]}
        selectedSnapshotId=""
        onSelectSnapshotId={vi.fn()}
        onRefreshSnapshots={vi.fn()}
        isLoadingSnapshots={false}
        syncStatus={{ state: 'idle', message: '' }}
        setSyncStatus={vi.fn()}
      />,
    );

    expect(screen.getByText(/Google SDK timed out/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry Google Setup/i })).not.toBeInTheDocument();
  });
});
