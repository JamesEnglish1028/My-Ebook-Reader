import React, { useMemo, useRef, useState } from 'react';

import { useCatalogContent, useFocusTrap } from '../../hooks';
import type { Catalog } from '../../types';
import { CloseIcon, SearchIcon } from '../icons';

interface PalaceCatalogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  registryUrl: string;
  existingCatalogs: Catalog[];
  onSelectCatalog: (name: string, url: string) => void;
}

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase();

const PalaceCatalogPickerModal: React.FC<PalaceCatalogPickerModalProps> = ({
  isOpen,
  onClose,
  registryUrl,
  existingCatalogs,
  onSelectCatalog,
}) => {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen,
    onEscape: onClose,
    initialFocusRef: searchRef,
  });

  const { data, isLoading } = useCatalogContent(
    isOpen ? registryUrl : null,
    registryUrl,
    '2',
    isOpen,
  );

  const existingCatalogsByUrl = useMemo(() => {
    const entries = new Map<string, Catalog>();
    existingCatalogs.forEach((catalog) => entries.set(normalizeUrl(catalog.url), catalog));
    return entries;
  }, [existingCatalogs]);

  const filteredLinks = useMemo(() => {
    const navigationLinks = data?.navigationLinks ?? [];
    const searchValue = query.trim().toLowerCase();
    if (!searchValue) return navigationLinks;
    return navigationLinks.filter((link) => link.title.toLowerCase().includes(searchValue));
  }, [data?.navigationLinks, query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a Palace library"
    >
      <div
        ref={modalRef}
        className="theme-surface-elevated theme-border theme-text-primary flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="theme-divider flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="theme-text-primary text-sm font-semibold">Choose a Palace Library</h3>
            <p className="theme-text-muted text-xs">Search and add a Palace catalog directly from the registry</p>
          </div>
          <button
            onClick={onClose}
            className="theme-text-muted theme-hover-surface rounded-full p-2 transition-colors"
            aria-label="Close Palace library picker"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="theme-divider border-b px-4 py-3">
          <label htmlFor="palace-library-search" className="sr-only">Search Palace libraries</label>
          <div className="theme-input flex items-center gap-2 rounded-lg border px-3 py-2">
            <SearchIcon className="theme-text-muted h-4 w-4" />
            <input
              ref={searchRef}
              id="palace-library-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search libraries"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="theme-surface min-h-[16rem] flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <p className="theme-text-muted px-2 py-8 text-center text-sm">Loading Palace libraries...</p>
          ) : data?.error ? (
            <div className="theme-surface-elevated rounded-lg border px-4 py-6 text-center">
              <p className="theme-text-danger text-sm font-medium">Unable to load the Palace library registry.</p>
              <p className="theme-text-muted mt-2 text-xs">{data.error}</p>
            </div>
          ) : filteredLinks.length > 0 ? (
            <ul className="space-y-2">
              {filteredLinks.map((link) => {
                const existingCatalog = existingCatalogsByUrl.get(normalizeUrl(link.url));
                return (
                  <li key={link.url}>
                    <button
                      onClick={() => onSelectCatalog(existingCatalog?.name || link.title, link.url)}
                      className="theme-hover-surface theme-border flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="theme-text-primary truncate text-sm font-medium">{existingCatalog?.name || link.title}</div>
                        <div className="theme-text-muted truncate text-xs">{link.url}</div>
                      </div>
                      <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${existingCatalog ? 'theme-button-neutral' : 'theme-button-primary'}`}>
                        {existingCatalog ? 'Open' : 'Add'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="theme-text-muted px-2 py-8 text-center text-sm">No Palace libraries match that search.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PalaceCatalogPickerModal;
