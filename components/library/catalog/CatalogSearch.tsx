import React from 'react';

interface CatalogSearchProps {
  value: string;
  onChange: (value: string) => void;
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
  onSubmit,
  onClear,
  disabled = false,
  isLoading = false,
  errorMessage = null,
  hasActiveSearch = false,
}) => {
  const trimmedValue = value.trim();

  return (
    <section className="mb-5 rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Catalog Search</h3>
        <span className="text-[11px] text-slate-500">
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
          placeholder="Search this catalog"
          disabled={disabled}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Search this catalog"
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
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {errorMessage && (
        <p className="mt-2 text-xs text-rose-300">{errorMessage}</p>
      )}
    </section>
  );
};

export default CatalogSearch;
