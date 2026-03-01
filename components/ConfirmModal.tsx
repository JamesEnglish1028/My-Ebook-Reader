import React, { useRef } from 'react';

import { useFocusTrap } from '../hooks';

import { CloseIcon } from './icons';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
  variant?: 'default' | 'danger';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title = 'Confirm', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onClose, onConfirm, variant = 'default' }) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen,
    onEscape: onClose,
    initialFocusRef: cancelBtnRef,
  });


  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        ref={modalRef}
        className="theme-surface-elevated theme-border theme-text-primary w-full max-w-md rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-xl font-bold ${variant === 'danger' ? 'text-red-300' : 'theme-accent-text'}`}>{title}</h2>
          <button onClick={onClose} className="theme-hover-surface p-2 rounded-full transition-colors" aria-label="Close">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <p className="theme-text-secondary mb-6 text-sm">{message}</p>
        <div className="flex justify-end gap-4">
          <button
            ref={cancelBtnRef}
            onClick={onClose}
            className="theme-button-neutral theme-hover-surface rounded-md px-4 py-2 font-semibold transition-colors"
            tabIndex={0}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`py-2 px-6 rounded-md transition-colors font-bold ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'theme-button-primary'}`}
            tabIndex={0}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
