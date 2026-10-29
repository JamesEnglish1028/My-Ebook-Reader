/// <reference types="vite-plugin-pwa/client" />

import React, { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const PwaUpdateNotice: React.FC = () => {
  const [registrationError, setRegistrationError] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() {
      setRegistrationError(true);
    },
  });

  const message = needRefresh
    ? 'A new version of MeBooks is ready.'
    : offlineReady
      ? 'MeBooks is ready to use offline for books saved on this device.'
      : registrationError
        ? 'Offline app setup is unavailable. You can continue using MeBooks online.'
        : null;

  if (!message) return null;

  return (
    <div
      className="theme-surface-elevated theme-border theme-text-primary fixed bottom-4 left-4 right-4 z-[60] mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-lg border p-4 shadow-xl"
      role={needRefresh ? 'alert' : 'status'}
    >
      <p className="text-sm">{message}</p>
      <div className="flex items-center gap-2">
        {needRefresh && (
          <button
            type="button"
            className="theme-button-primary rounded px-3 py-2 text-sm font-semibold"
            onClick={() => void updateServiceWorker(true)}
          >
            Reload to update
          </button>
        )}
        {needRefresh ? (
          <button
            type="button"
            className="theme-button-secondary rounded px-3 py-2 text-sm font-semibold"
            onClick={() => setNeedRefresh(false)}
          >
            Later
          </button>
        ) : (
          <button
            type="button"
            className="theme-button-secondary rounded px-3 py-2 text-sm font-semibold"
            onClick={() => {
              setOfflineReady(false);
              setRegistrationError(false);
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default PwaUpdateNotice;
