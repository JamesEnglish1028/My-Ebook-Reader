import React, { useEffect, useRef, useState } from 'react';

import { useFocusTrap } from '../hooks';

import { CloseIcon } from './icons';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
}

const CitationModal: React.FC<CitationModalProps> = ({ isOpen, onClose, onSave }) => {
  const [note, setNote] = useState('');
  const charLimit = 50;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Apply focus trap to modal
  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen,
    initialFocusRef: textareaRef,
    onEscape: onClose,
  });

  useEffect(() => {
    if (isOpen) {
      setNote(''); // Reset note when modal opens
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(note);
  };

  const remainingChars = charLimit - note.length;

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
          <h2 className="text-xl font-bold text-sky-300">Create Citation</h2>
          <button onClick={onClose} className="theme-hover-surface rounded-full p-2 transition-colors" aria-label="Close">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <p className="theme-text-secondary mb-4 text-sm">
          A citation for the current location will be created. You can add an optional note below.
        </p>

        <div>
          <label htmlFor="citation-note" className="theme-text-secondary mb-2 block text-sm font-medium">
            Note (optional)
          </label>
          <textarea
            ref={textareaRef}
            id="citation-note"
            rows={3}
            value={note}
            onChange={(e) => {
              if (e.target.value.length <= charLimit) {
                setNote(e.target.value);
              }
            }}
            className="theme-input w-full rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Add a brief note..."
          />
          <p className={`mt-1 text-right text-xs ${remainingChars < 10 ? 'theme-text-danger' : 'theme-text-muted'}`}>
            {remainingChars} characters remaining
          </p>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={onClose}
            className="theme-button-neutral theme-hover-surface rounded-md px-4 py-2 font-semibold transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            className="py-2 px-6 rounded-md bg-sky-500 hover:bg-sky-600 transition-colors font-bold"
          >
            Save Citation
          </button>
        </div>
      </div>
    </div>
  );
};

export default CitationModal;
