import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initGoogleClient, revokeToken } from '../../services/google';
import { AuthProvider, useAuth } from '../AuthContext';

vi.mock('../../services/google', () => ({
  revokeToken: vi.fn(),
  initGoogleClient: vi.fn(),
}));

const Consumer: React.FC = () => {
  const { user, isLoggedIn, signIn, signOut, isInitialized, authStatus, authError } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <span data-testid="logged-in">{isLoggedIn ? 'yes' : 'no'}</span>
      <span data-testid="initialized">{isInitialized ? 'yes' : 'no'}</span>
      <span data-testid="auth-status">{authStatus}</span>
      <span data-testid="auth-error">{authError || 'none'}</span>
      <button onClick={signIn}>Sign In</button>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();

    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        name: 'Jane Reader',
        email: 'jane@example.com',
        picture: 'https://example.com/pic.png',
      }),
    }));
  });

  it('throws if useAuth is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
    expect(() => render(<Consumer />)).toThrow(/useAuth must be used within an AuthProvider/);
    spy.mockRestore();
  });

  it('moves to not_configured status when init fails due to missing env', async () => {
    vi.mocked(initGoogleClient).mockRejectedValueOnce(new Error('Set VITE_GOOGLE_CLIENT_ID in your environment.'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('yes');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not_configured');
      expect(screen.getByTestId('auth-error')).toHaveTextContent('VITE_GOOGLE_CLIENT_ID');
    });
  });

  it('falls back from silent token request to consent prompt on sign in', async () => {
    let callback: ((response: any) => void) | null = null;
    const requestAccessToken = vi.fn();

    vi.mocked(initGoogleClient).mockImplementation(async (cb: any) => {
      callback = cb;
      return { requestAccessToken };
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('yes');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByText('Sign In'));
    expect(requestAccessToken).toHaveBeenLastCalledWith({ prompt: '' });

    await act(async () => {
      callback?.({ error: 'consent_required' });
    });

    expect(requestAccessToken).toHaveBeenLastCalledWith({ prompt: 'consent' });

    await act(async () => {
      callback?.({ access_token: 'token-123', expires_in: 3600 });
    });

    await waitFor(() => {
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes');
      expect(screen.getByTestId('user')).toHaveTextContent('jane@example.com');
    });

    expect(localStorage.getItem('g_access_token')).toBe('token-123');
    expect(localStorage.getItem('g_access_token_expires_at')).toBeTruthy();
  });

  it('calls signOut and clears localStorage', async () => {
    vi.mocked(initGoogleClient).mockResolvedValueOnce({ requestAccessToken: vi.fn() });

    localStorage.setItem('g_access_token', 'fake');
    localStorage.setItem('g_access_token_expires_at', String(Date.now() + 3600 * 1000));
    localStorage.setItem('ebook-reader-drive-folder-id', 'folder');
    localStorage.setItem('ebook-reader-drive-file-id', 'file');
    localStorage.setItem('ebook-reader-last-sync', 'now');

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('yes');
    });

    fireEvent.click(screen.getByText('Sign Out'));

    expect(localStorage.getItem('g_access_token')).toBeNull();
    expect(localStorage.getItem('g_access_token_expires_at')).toBeNull();
    expect(localStorage.getItem('ebook-reader-drive-folder-id')).toBeNull();
    expect(localStorage.getItem('ebook-reader-drive-file-id')).toBeNull();
    expect(localStorage.getItem('ebook-reader-last-sync')).toBeNull();
    expect(revokeToken).toHaveBeenCalled();
  });
});
