import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
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
  it('renders not-configured message and disables sign-in button', () => {
    const authValue: ReturnType<typeof useAuth> = {
      user: null,
      isLoggedIn: false,
      signIn: vi.fn(),
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
        syncStatus={{ state: 'idle', message: '' }}
        setSyncStatus={vi.fn()}
      />,
    );

    expect(screen.getByText(/Google sync is not configured/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Google Sync Not Configured/i })).toBeDisabled();
  });

  it('uses retry label when auth setup is in error state', () => {
    const signIn = vi.fn();
    const authValue: ReturnType<typeof useAuth> = {
      user: null,
      isLoggedIn: false,
      signIn,
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
        syncStatus={{ state: 'idle', message: '' }}
        setSyncStatus={vi.fn()}
      />,
    );

    const retryButton = screen.getByRole('button', { name: /Retry Google Setup/i });
    fireEvent.click(retryButton);
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
