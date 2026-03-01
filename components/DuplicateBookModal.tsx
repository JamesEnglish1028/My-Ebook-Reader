import React from 'react';

import { useFocusTrap } from '../hooks';

import { CloseIcon } from './icons';

interface DuplicateBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplace: () => void;
  onAddAnyway: () => void;
  bookTitle: string;
}

const DuplicateBookModal: React.FC<DuplicateBookModalProps> = ({ isOpen, onClose, onReplace, onAddAnyway, bookTitle }) => {
  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen,
    onEscape: onClose,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={modalRef}
        className="theme-surface-elevated theme-border theme-text-primary w-full max-w-md rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-yellow-300">Duplicate Book Found</h2>
          <button onClick={onClose} className="theme-hover-surface rounded-full p-2 transition-colors" aria-label="Close">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <p className="theme-text-secondary mb-6 text-sm">
          The book "<strong className="theme-text-primary font-semibold">{bookTitle}</strong>" is already in your library. What would you like to do?
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onReplace}
            className="w-full py-2.5 px-4 rounded-md bg-sky-500 hover:bg-sky-600 transition-colors font-bold"
          >
            Replace Existing
          </button>
          <button
            onClick={onAddAnyway}
            className="theme-button-neutral theme-hover-surface w-full rounded-md px-4 py-2.5 font-semibold transition-colors"
          >
            Add as New Copy
          </button>
          <button
            onClick={onClose}
            className="theme-text-muted w-full px-4 py-2 text-sm transition-colors hover:text-sky-400"
          >
            Cancel Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateBookModal;
