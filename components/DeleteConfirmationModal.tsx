import React from 'react';

import { useFocusTrap } from '../hooks';

import { CloseIcon, TrashIcon } from './icons';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  bookTitle: string;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ isOpen, onClose, onConfirm, bookTitle }) => {
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
          <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
            <TrashIcon className="w-6 h-6" />
            Confirm Deletion
          </h2>
          <button onClick={onClose} className="theme-hover-surface rounded-full p-2 transition-colors" aria-label="Close">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <p className="theme-text-secondary mb-6 text-sm">
          Are you sure you want to permanently delete "<strong className="theme-text-primary font-semibold">{bookTitle}</strong>"? This action cannot be undone.
        </p>

        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="theme-button-neutral theme-hover-surface rounded-md px-4 py-2 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="py-2 px-6 rounded-md bg-red-600 hover:bg-red-700 transition-colors font-bold"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
