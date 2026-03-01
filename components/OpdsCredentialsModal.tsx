import React, { useEffect, useRef, useState } from 'react';

import { useFocusTrap } from '../hooks';
import { maybeProxyForCors } from '../services/utils';

interface Props {
  isOpen: boolean;
  host: string | null;
  authDocument?: any;
  onClose: () => void;
  onSubmit: (username: string, password: string, save: boolean) => void;
  // Called when the user clicks a provider auth link (the modal will still open the link via window.open)
  onOpenAuthLink?: (href: string) => void;
  // Called when the user clicks Retry after finishing provider login
  onRetry?: () => void;
  // Optional URL to probe for direct access (prefer this over probing the auth link)
  probeUrl?: string | null;
}

const OpdsCredentialsModal: React.FC<Props> = ({ isOpen, host, authDocument, onClose, onSubmit, onOpenAuthLink, onRetry, probeUrl }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [save, setSave] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setUsername(''); setPassword(''); setSave(false);
      return;
    }

    // When opening, prefill hints from authDocument if available
    const userHint = authDocument?.username_hint || authDocument?.username || authDocument?.suggested_username || '';
    const passHint = authDocument?.password_hint || '';
    if (userHint) setUsername(String(userHint));
    // Do not prefill password for security, but set placeholder via attribute below
    if (passHint) setPassword('');
  }, [isOpen]);

  // Polling state: when user opens provider auth link we can periodically
  // probe whether direct CORS access is now allowed (this is a best-effort
  // indicator that the provider set a session cookie and the server is
  // allowing credentialed requests). This is optional and will be skipped
  // in test / non-browser environments.
  const [isPolling, setIsPolling] = useState(false);
  const [directAvailable, setDirectAvailable] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      if (pollRef.current) {
        try { window.clearInterval(pollRef.current); } catch (_) { }
        pollRef.current = null;
      }
    };
  }, []);

  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen,
    onEscape: onClose,
  });

  if (!isOpen) return null;

  const realmFromAuth = authDocument?.realm || authDocument?.title || null;
  const description = authDocument?.description || authDocument?.instructions || null;
  const logo = authDocument?.logo || authDocument?.image || null;
  const links: any[] = Array.isArray(authDocument?.links) ? authDocument.links : [];
  return (
    <div className="theme-shell fixed inset-0 z-50 flex items-center justify-center bg-opacity-75 p-4">
      <div ref={modalRef} className="theme-surface-elevated theme-border theme-text-primary w-full max-w-md rounded-lg border p-6">
        <div className="flex items-start gap-4 mb-2">
          {logo && <img src={logo} alt="provider logo" className="w-12 h-12 object-contain" />}
          <div>
            <h3 className="text-lg font-semibold">{realmFromAuth ? `Login to ${realmFromAuth}` : 'Authentication required'}</h3>
            <p className="theme-text-secondary text-sm">This catalog at <span className="font-mono">{host}</span> requires credentials to access the requested content.</p>
          </div>

          {/* Polling status and auto-retry */}
          {isPolling && (
            <div className="theme-text-secondary mb-3 text-sm">
              Waiting for provider sign-in to complete... This may take a minute.
            </div>
          )}
          {directAvailable && (
            <div className="mb-3 text-sm text-emerald-300 flex items-center justify-between">
              <span>Direct access appears to be available. You can retry the acquisition now.</span>
              <div className="ml-4">
                <button
                  onClick={() => {
                    // stop polling and trigger retry
                    if (pollRef.current) { try { window.clearInterval(pollRef.current); } catch (_) { } pollRef.current = null; }
                    setIsPolling(false);
                    if (typeof onRetry === 'function') onRetry();
                  }}
                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Retry now
                </button>
              </div>
            </div>
          )}
        </div>
        {description && <p className="theme-text-secondary mb-4 text-sm">{description}</p>}

        {links.length > 0 && (
          <div className="theme-text-secondary mb-4 text-sm">
            <div className="font-semibold mb-1">Authentication Links</div>
            <ul className="list-disc list-inside">
              {links.map((l, i) => (
                <li key={i}><a className="text-sky-400" href={l.href} target="_blank" rel="noreferrer">{l.title || l.href}</a> {l.rel ? <span className="theme-text-muted text-xs">({l.rel})</span> : null}</li>
              ))}
            </ul>
          </div>
        )}

        {/* If there's an authenticate link, show a CTA to open it and a retry button */}
        {links.length > 0 && (
          <div className="mb-4 flex gap-2">
            {links.map((l, i) => {
              const isAuth = (l.rel || '').toString().includes('authenticate');
              return isAuth ? (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      // Open in new tab/window for the user to login
                      let win: Window | null = null;
                      try { win = window.open(l.href, '_blank', 'noopener'); } catch (e) { win = null; }
                      if (typeof onOpenAuthLink === 'function') {
                        onOpenAuthLink(l.href);
                      }

                      // Start a lightweight poll to detect whether direct access
                      // (CORS with credentials) is now available. Prefer probing the
                      // acquisition/probe URL when available; fall back to the auth
                      // link itself. This is best-effort and will not break if the
                      // provider doesn't expose CORS.
                      try {
                        if (!win || typeof window === 'undefined' || typeof maybeProxyForCors !== 'function') return;
                        setIsPolling(true);
                        setDirectAvailable(false);
                        let attempts = 0;
                        const maxAttempts = 30; // ~60s if interval 2000ms
                        const target = probeUrl || l.href;
                        pollRef.current = window.setInterval(async () => {
                          attempts += 1;
                          try {
                            // Probe the target URL; if maybeProxyForCors returns
                            // the original URL (not proxied) it's an indicator that
                            // the server is now permitting direct requests from the browser.
                            const res = await maybeProxyForCors(target as string);
                            if (res === target) {
                              setDirectAvailable(true);
                              setIsPolling(false);
                              if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
                            }
                          } catch (e) {
                            // ignore transient errors
                          }
                          if (attempts >= maxAttempts) {
                            setIsPolling(false);
                            if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
                          }
                        }, 2000);
                      } catch (e) {
                        // If polling cannot be started, silently ignore and let user click Retry
                      }
                    }}
                    className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Open sign-in page
                  </button>
                </div>
              ) : null;
            })}
          </div>
        )}

        <label htmlFor="opds-username" className="theme-text-secondary mb-1 block text-sm">Username</label>
        <input id="opds-username" aria-label="username" placeholder={authDocument?.username_placeholder || 'Username'} value={username} onChange={(e) => setUsername(e.target.value)} className="theme-input mb-3 w-full rounded border p-2" />

        <label htmlFor="opds-password" className="theme-text-secondary mb-1 block text-sm">Password</label>
        <input id="opds-password" aria-label="password" placeholder={authDocument?.password_placeholder || 'Password'} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="theme-input mb-3 w-full rounded border p-2" />

        {authDocument?.username_hint && <div className="theme-text-muted mb-2 text-xs">Hint: {authDocument.username_hint}</div>}
        {authDocument?.password_hint && <div className="theme-text-muted mb-2 text-xs">Password: {authDocument.password_hint}</div>}

        <div className="flex items-center gap-2 mb-4">
          <input id="saveCred" type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
          <label htmlFor="saveCred" className="theme-text-secondary text-sm">Save credential for this host</label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="theme-button-neutral theme-hover-surface rounded px-4 py-2">Cancel</button>
          {/* If a retry handler is provided, show a Retry button so users can retry after using the provider login page */}
          {typeof onRetry === 'function' && (
            <button onClick={() => onRetry()} className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-500">Retry</button>
          )}
          <button onClick={() => onSubmit(username, password, save)} className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-600">Continue</button>
        </div>
      </div>
    </div>
  );
};

export default OpdsCredentialsModal;
