import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';

import type { GoogleUser } from '../domain/sync/types';
import { initGoogleClient, revokeToken } from '../services/google';

type AuthStatus = 'initializing' | 'ready' | 'error' | 'not_configured';
type TokenRequestMode = 'none' | 'restore_silent' | 'interactive_silent' | 'interactive_consent';
const REQUIRED_GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'profile',
  'email',
];

interface AuthContextType {
  user: GoogleUser | null;
  isLoggedIn: boolean;
  tokenClient: any | null;
  signIn: () => void;
  signOut: () => void;
  isInitialized: boolean;
  authStatus: AuthStatus;
  authError: string | null;
}

const TOKEN_KEY = 'g_access_token';
const TOKEN_EXPIRY_KEY = 'g_access_token_expires_at';

const parseExpiryMs = (raw: unknown): number | null => {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) return null;
  // Heuristic: seconds vs milliseconds.
  return num > 1e12 ? num : num * 1000;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [tokenClient, setTokenClient] = useState<any | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('initializing');
  const [authError, setAuthError] = useState<string | null>(null);

  const tokenRequestModeRef = useRef<TokenRequestMode>('none');
  const tokenClientRef = useRef<any | null>(null);
  const isLoggedIn = !!user;

  const clearStoredToken = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }, []);

  const signOut = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      revokeToken(token);
    }
    setUser(null);
    setAuthError(null);
    clearStoredToken();
    localStorage.removeItem('ebook-reader-drive-folder-id');
    localStorage.removeItem('ebook-reader-drive-file-id');
    localStorage.removeItem('ebook-reader-last-sync');
    if (window.gapi?.client) {
      window.gapi.client.setToken(null);
    }
  }, [clearStoredToken]);

  const storeAccessToken = useCallback((response: any): number | null => {
    if (!response?.access_token) return null;
    localStorage.setItem(TOKEN_KEY, response.access_token);
    let expiresAt: number | null = null;
    const expiresIn = Number(response.expires_in);
    if (Number.isFinite(expiresIn) && expiresIn > 0) {
      expiresAt = Date.now() + (expiresIn * 1000);
    } else {
      expiresAt = parseExpiryMs(response.expires_at);
    }

    if (expiresAt !== null) {
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
    } else {
      // Prevent stale expiry from previous sessions causing false "expired" errors.
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
    return expiresAt;
  }, []);

  const hasValidStoredToken = useCallback((): string | null => {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresRaw = localStorage.getItem(TOKEN_EXPIRY_KEY);
    const expiresAt = expiresRaw ? Number(expiresRaw) : NaN;

    if (!token) return null;
    if (!Number.isFinite(expiresAt)) {
      clearStoredToken();
      return null;
    }

    // 60-second safety buffer to avoid using about-to-expire tokens.
    if (expiresAt <= Date.now() + 60000) {
      clearStoredToken();
      return null;
    }

    return token;
  }, [clearStoredToken]);

  const fetchUserProfile = useCallback(async (accessToken: string, expiresAtMs?: number | null) => {
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userInfoResponse.ok) {
        throw new Error(`Failed to fetch user profile, status: ${userInfoResponse.status}`);
      }
      const profile = await userInfoResponse.json();

      if (window.gapi?.client) {
        const tokenPayload: Record<string, unknown> = { access_token: accessToken };
        if (typeof expiresAtMs === 'number' && Number.isFinite(expiresAtMs)) {
          tokenPayload.expires_at = expiresAtMs;
        }
        window.gapi.client.setToken(tokenPayload);
      }

      setUser({
        name: profile.name,
        email: profile.email,
        picture: profile.picture,
      });
      setAuthError(null);
      setAuthStatus('ready');
    } catch (error) {
      console.error('Token validation/profile fetch failed:', error);
      signOut();
      setAuthStatus('ready');
      setAuthError('Google session is invalid or expired. Please sign in again.');
    }
  }, [signOut]);

  const requestAccessToken = useCallback((mode: TokenRequestMode) => {
    if (!tokenClientRef.current) return;
    tokenRequestModeRef.current = mode;
    const prompt = mode === 'interactive_consent' ? 'consent' : '';
    try {
      tokenClientRef.current.requestAccessToken({ prompt });
    } catch (error) {
      console.error('Google token request failed to start:', error);
      tokenRequestModeRef.current = 'none';
      const message = error instanceof Error ? error.message : 'Google sign-in request failed.';
      setAuthError(message);
    }
  }, []);

  const handleCredentialResponse = useCallback(async (response: any) => {
    const requestMode = tokenRequestModeRef.current;
    tokenRequestModeRef.current = 'none';

    if (response?.error) {
      if (requestMode === 'interactive_silent') {
        requestAccessToken('interactive_consent');
        return;
      }

      const message = response.error_description || response.error || 'Google sign-in failed.';
      setAuthError(message);
      return;
    }

    const hasAllScopes = (() => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2?.hasGrantedAllScopes && response?.access_token) {
        try {
          return oauth2.hasGrantedAllScopes(response, ...REQUIRED_GOOGLE_SCOPES);
        } catch {
          // Fall through to string-based scope parsing.
        }
      }
      const grantedScopes = typeof response?.scope === 'string'
        ? response.scope.split(/\s+/).filter(Boolean)
        : [];
      return REQUIRED_GOOGLE_SCOPES.every((scope) => grantedScopes.includes(scope));
    })();

    if (!hasAllScopes) {
      if (requestMode !== 'interactive_consent') {
        requestAccessToken('interactive_consent');
        return;
      }
      setAuthError('Google Drive access was not granted. Please approve Drive access to use cloud sync.');
      return;
    }

    if (response?.access_token) {
      const expiresAtMs = storeAccessToken(response);
      await fetchUserProfile(response.access_token, expiresAtMs);
    }
  }, [fetchUserProfile, requestAccessToken, storeAccessToken]);

  useEffect(() => {
    const initialize = async () => {
      setAuthStatus('initializing');
      setAuthError(null);
      try {
        const client = await initGoogleClient(handleCredentialResponse);
        tokenClientRef.current = client;
        setTokenClient(client);
        setAuthStatus('ready');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google initialization failed.';
        if (message.includes('VITE_GOOGLE_CLIENT_ID')) {
          setAuthStatus('not_configured');
        } else {
          setAuthStatus('error');
        }
        setAuthError(message);
      } finally {
        setIsInitialized(true);
      }
    };
    initialize();
  }, [handleCredentialResponse]);

  useEffect(() => {
    if (!isInitialized || authStatus !== 'ready') return;

    const hadStoredToken = Boolean(localStorage.getItem(TOKEN_KEY));
    const storedToken = hasValidStoredToken();
    if (storedToken) {
      void fetchUserProfile(storedToken);
      return;
    }

    // Only attempt automatic silent restoration when a prior token existed.
    // This avoids background token requests on first-run sessions.
    if (tokenClient && hadStoredToken) {
      requestAccessToken('restore_silent');
    }
  }, [authStatus, fetchUserProfile, hasValidStoredToken, isInitialized, requestAccessToken, tokenClient]);

  const signIn = useCallback(() => {
    if (!tokenClientRef.current) return;
    setAuthError(null);
    requestAccessToken('interactive_consent');
  }, [requestAccessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        tokenClient,
        signIn,
        signOut,
        isInitialized,
        authStatus,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
