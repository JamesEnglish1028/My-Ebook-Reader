import React, { useRef } from 'react';

import { formatShortcut, useFocusTrap, type ShortcutAction } from '../hooks';

import { AdjustmentsVerticalIcon, MinusIcon, PlusIcon } from './icons';
import Tooltip from './Tooltip';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Optional handlers for contextual actions (PDF or EPUB)
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onToggleFit?: () => void;
  // If true, indicates the active reader is EPUB (so zoom adjusts font-size)
  activeReader?: 'epub' | 'pdf' | null;
}

const ShortcutHelpModal: React.FC<Props> = ({ isOpen, onClose, onZoomIn, onZoomOut, onToggleFit, activeReader = null }) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const dialogRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen,
    initialFocusRef: closeButtonRef,
    onEscape: onClose,
  });

  if (!isOpen) return null;

  // Define shortcuts based on context
  const globalShortcuts: ShortcutAction[] = [
    { key: '?', description: 'Show/hide keyboard shortcuts', category: 'global', action: () => { } },
    { key: 'Escape', description: 'Close active modal or return to library', category: 'global', action: () => { } },
  ];

  const readerShortcuts: ShortcutAction[] = activeReader ? [
    { key: 'ArrowLeft', description: 'Previous page', category: 'reader', action: () => { } },
    { key: 'ArrowRight', description: 'Next page', category: 'reader', action: () => { } },
    { key: ' ', description: 'Next page', category: 'reader', action: () => { } },
    { key: '+', description: `Zoom in ${activeReader === 'epub' ? '(increase font size)' : ''}`, category: 'reader', action: () => { } },
    { key: '-', description: `Zoom out ${activeReader === 'epub' ? '(decrease font size)' : ''}`, category: 'reader', action: () => { } },
    { key: 'f', description: 'Toggle fit width / fit page', category: 'reader', action: () => { } },
    { key: 'c', description: 'Open/close contents & bookmarks', category: 'reader', action: () => { } },
    { key: 'b', description: 'Add a quick bookmark for current page', category: 'reader', action: () => { } },
  ] : [];

  const renderShortcut = (shortcut: ShortcutAction) => (
    <li key={`${shortcut.key}-${shortcut.description}`} className="flex items-start gap-2">
      <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono min-w-[3rem] text-center theme-surface-elevated">
        {formatShortcut(shortcut)}
      </kbd>
      <span className="flex-1">{shortcut.description}</span>
    </li>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" role="presentation">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        className="relative bg-slate-800 text-white rounded-lg shadow-lg max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto border theme-surface-elevated theme-border theme-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="shortcut-help-title" className="text-xl font-bold">Keyboard Shortcuts</h3>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 theme-hover-surface"
            aria-label="Close help"
          >
            ✕
          </button>
        </div>

        {/* Global shortcuts */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 theme-text-secondary">Global</h4>
          <ul className="space-y-2 text-sm">
            {globalShortcuts.map(renderShortcut)}
          </ul>
        </div>

        {/* Reader shortcuts */}
        {activeReader && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 theme-text-secondary">
              Reader ({activeReader === 'epub' ? 'EPUB' : 'PDF'})
            </h4>
            <ul className="space-y-2 text-sm">
              {readerShortcuts.map(renderShortcut)}
            </ul>
          </div>
        )}

        {/* Action buttons for reader controls */}
        {activeReader && onZoomIn && onZoomOut && onToggleFit && (
          <div className="mt-6 pt-4 border-t border-slate-700 theme-divider">
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 theme-text-secondary">Quick Actions</h4>
            <div className="flex gap-2">
              <Tooltip label="Zoom out (-)">
                <button
                  onClick={onZoomOut}
                  className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 theme-button-neutral theme-hover-surface"
                  aria-label="Zoom out"
                >
                  <MinusIcon className="w-5 h-5 text-slate-50" />
                </button>
              </Tooltip>
              <Tooltip label="Zoom in (+)">
                <button
                  onClick={onZoomIn}
                  className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 theme-button-neutral theme-hover-surface"
                  aria-label="Zoom in"
                >
                  <PlusIcon className="w-5 h-5 text-slate-50" />
                </button>
              </Tooltip>
              <Tooltip label="Toggle fit (F)">
                <button
                  onClick={onToggleFit}
                  className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 theme-button-neutral theme-hover-surface"
                  aria-label="Toggle fit mode"
                >
                  <AdjustmentsVerticalIcon className="w-5 h-5 text-slate-50" />
                </button>
              </Tooltip>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-700 text-xs text-slate-400 theme-divider theme-text-secondary">
          <p>💡 Tip: Keyboard shortcuts are disabled when typing in text fields.</p>
          <p className="mt-1">Press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-xs theme-surface-elevated">?</kbd> anytime to view this help.</p>
        </div>
      </div>
    </div>
  );
};

export default ShortcutHelpModal;
