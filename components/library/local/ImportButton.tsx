import React, { useRef } from 'react';

import { UploadIcon } from '../../icons';

interface ImportButtonProps {
  /** Whether import is currently in progress */
  isLoading: boolean;
  /** Callback when file is selected */
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Optional callback when the control is activated */
  onActivate?: () => void;
  /** Whether to always show the label text on small screens */
  alwaysShowLabel?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * ImportButton - File upload button for importing books
 *
 * Provides a styled button that triggers a hidden file input.
 * Accepts .epub and .pdf files.
 */
const ImportButton: React.FC<ImportButtonProps> = ({
  isLoading,
  onFileChange,
  onActivate,
  alwaysShowLabel = false,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <label
        htmlFor="epub-upload"
        onClick={onActivate}
        className={`cursor-pointer bg-sky-500 hover:bg-sky-600 text-white font-bold p-2 sm:py-2 sm:px-4 rounded-lg inline-flex items-center transition-colors duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''
          } ${className}`}
      >
        <UploadIcon className="w-5 h-5 sm:mr-2" />
        <span className={alwaysShowLabel ? 'inline' : 'hidden sm:inline'}>Import Book</span>
      </label>
      <input
        ref={fileInputRef}
        id="epub-upload"
        type="file"
        accept=".epub,.pdf"
        className="hidden"
        onChange={onFileChange}
        disabled={isLoading}
        aria-label="Upload EPUB or PDF file"
      />
    </>
  );
};

export default ImportButton;
