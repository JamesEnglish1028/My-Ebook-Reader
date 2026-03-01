import React, { useEffect, useRef } from 'react';

interface ToastProps {
  message: string | null;
  duration?: number; // milliseconds
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, duration = 3000, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!message) return;
    const el = containerRef.current;
    if (el) {
      // Move focus to the toast for screen reader announcement / keyboard users
      try { el.focus(); } catch (e) { /* ignore */ }
    }
    const t = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;
  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      tabIndex={-1}
      className="fixed bottom-6 right-6 z-50"
    >
      <div className="bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2 rounded shadow theme-surface-elevated theme-border theme-text-secondary">
        {message}
      </div>
    </div>
  );
};

export default Toast;
