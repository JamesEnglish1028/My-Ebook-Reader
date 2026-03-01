import React from 'react';

import { useFocusTrap } from '../hooks';
import type { UiThemePreference } from '../hooks/useUiTheme';

import { CloseIcon } from './icons';

interface ThemeModalProps {
  isOpen: boolean;
  currentTheme: UiThemePreference;
  onClose: () => void;
  onSelectTheme: (theme: UiThemePreference) => void;
}

const THEME_OPTIONS: UiThemePreference[] = ['system', 'light', 'dark'];

const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  currentTheme,
  onClose,
  onSelectTheme,
}) => {
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-sky-300">UI Theme</h2>
          <button onClick={onClose} className="theme-hover-surface rounded-full p-2 transition-colors" aria-label="Close">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <p className="theme-text-secondary mb-5 text-sm">
          Choose how the app interface should look across the library and reader views.
        </p>

        <div className="space-y-3">
          {THEME_OPTIONS.map((themeOption) => {
            const isSelected = currentTheme === themeOption;
            const label = themeOption.charAt(0).toUpperCase() + themeOption.slice(1);

            return (
              <button
                key={themeOption}
                onClick={() => {
                  onSelectTheme(themeOption);
                  onClose();
                }}
                className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500/15 text-sky-200'
                    : 'theme-border theme-hover-surface'
                }`}
              >
                <span className="font-medium">{label}</span>
                <span className={`text-xs ${isSelected ? 'text-sky-300' : 'theme-text-muted'}`}>
                  {isSelected ? 'Current' : 'Select'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ThemeModal;
