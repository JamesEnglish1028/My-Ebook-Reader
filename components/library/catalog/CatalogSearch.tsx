import React, { useEffect, useState } from 'react';

import type { CatalogSearchTemplateParameter } from '../../../types';

interface CatalogSearchProps {
  value: string;
  onChange: (value: string) => void;
  primaryLabel?: string;
  primaryPlaceholder?: string;
  advancedFields?: CatalogSearchTemplateParameter[];
  advancedValues?: Record<string, string>;
  onAdvancedChange?: (name: string, value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  hasActiveSearch?: boolean;
}

const CatalogSearch: React.FC<CatalogSearchProps> = ({
  value,
  onChange,
  primaryLabel = 'Search this catalog',
  primaryPlaceholder = 'Search this catalog',
  advancedFields = [],
  advancedValues = {},
  onAdvancedChange,
  onSubmit,
  onClear,
  disabled = false,
  isLoading = false,
  errorMessage = null,
  hasActiveSearch = false,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const trimmedValue = value.trim();
  const hasAdvancedFields = advancedFields.length > 0;

  useEffect(() => {
    if (!hasAdvancedFields) {
      setShowAdvanced(false);
    }
  }, [hasAdvancedFields]);

  const formatFieldLabel = (name: string) => name
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

  return (
    <section className="theme-surface theme-border mb-5 rounded-xl border p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="theme-text-secondary text-xs font-semibold uppercase tracking-[0.18em]">Catalog Search</h3>
        <span className="theme-text-muted text-[11px]">
          {isLoading ? 'Loading search' : 'Remote query'}
        </span>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || trimmedValue.length === 0) return;
          onSubmit();
        }}
      >
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={primaryPlaceholder}
          disabled={disabled}
          className="theme-input min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={primaryLabel}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={disabled || trimmedValue.length === 0}
            className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Search
          </button>
          {hasActiveSearch && (
            <button
              type="button"
              onClick={onClear}
            className="theme-button-neutral theme-hover-surface rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {hasAdvancedFields && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="theme-text-secondary text-xs font-medium uppercase tracking-[0.14em] transition-colors hover:text-sky-300"
          >
            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
          </button>

          {showAdvanced && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {advancedFields.map((field) => (
                <label
                  key={field.name}
                  className="theme-text-secondary flex flex-col gap-1 text-xs font-medium uppercase tracking-[0.08em]"
                >
                  <span>{formatFieldLabel(field.name)}</span>
                  <input
                    type="text"
                    value={advancedValues[field.name] || ''}
                    onChange={(event) => onAdvancedChange?.(field.name, event.target.value)}
                    placeholder={`Optional ${formatFieldLabel(field.name).toLowerCase()}`}
                    disabled={disabled}
                    className="theme-input rounded-lg border px-3 py-2 text-sm normal-case tracking-normal focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={formatFieldLabel(field.name)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <p className="mt-2 text-xs text-rose-300">{errorMessage}</p>
      )}
    </section>
  );
};

export default CatalogSearch;
