import React, { useState } from 'react';

import { CATALOG_PRESETS, REGISTRY_PRESETS } from '../constants/opdsPresets';
import { useFocusTrap } from '../hooks';
import type { Catalog, CatalogRegistry } from '../types';

import { CheckIcon, CloseIcon, GlobeIcon, PencilIcon, PlusIcon, TrashIcon } from './icons';

interface ManageCatalogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    catalogs: Catalog[];
    onAddCatalog: (name: string, url: string, opdsVersion: 'auto' | '1' | '2') => void;
    onDeleteCatalog: (id: string) => void;
    onUpdateCatalog: (id: string, newName: string) => void;
    registries: CatalogRegistry[];
    onAddRegistry: (name: string, url: string) => void;
    onDeleteRegistry: (id: string) => void;
    onUpdateRegistry: (id: string, newName: string) => void;
}

const ManageCatalogsModal: React.FC<ManageCatalogsModalProps> = ({
    isOpen,
    onClose,
    catalogs,
    onAddCatalog,
    onDeleteCatalog,
    onUpdateCatalog,
    registries,
    onAddRegistry,
    onDeleteRegistry,
    onUpdateRegistry,
}) => {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [opdsVersion, setOpdsVersion] = useState<'auto' | '1' | '2'>('auto');
    const [error, setError] = useState('');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editedName, setEditedName] = useState('');
    const [activeTab, setActiveTab] = useState<'suggested' | 'catalogs' | 'registries'>('suggested');

    const modalRef = useFocusTrap<HTMLDivElement>({
        isActive: isOpen,
        onEscape: onClose,
    });

    if (!isOpen) return null;

    const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !url.trim()) {
            setError('Name and URL cannot be empty.');
            return;
        }
        try {
            new URL(url);
        } catch (_) {
            setError('Please enter a valid URL.');
            return;
        }
        setError('');

        if (activeTab === 'catalogs') {
            onAddCatalog(name, url, opdsVersion);
        } else if (activeTab === 'registries') {
            onAddRegistry(name, url);
        } else {
            return;
        }
        setName('');
        setUrl('');
    };

    const handleStartEdit = (item: Catalog | CatalogRegistry) => {
        setEditingItemId(item.id);
        setEditedName(item.name);
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditedName('');
    };

    const handleSaveEdit = () => {
        if (!editingItemId || !editedName.trim()) return;
        if (activeTab === 'catalogs') {
            onUpdateCatalog(editingItemId, editedName.trim());
        } else if (activeTab === 'registries') {
            onUpdateRegistry(editingItemId, editedName.trim());
        } else {
            return;
        }
        handleCancelEdit();
    };

    const currentList = activeTab === 'catalogs' ? catalogs : registries;
    const handleDelete = activeTab === 'catalogs' ? onDeleteCatalog : onDeleteRegistry;
    const existingCatalogUrls = new Set(catalogs.map((item) => normalizeUrl(item.url)));
    const existingRegistryUrls = new Set(registries.map((item) => normalizeUrl(item.url)));

    const handleAddPreset = (
        preset: typeof CATALOG_PRESETS[number] | typeof REGISTRY_PRESETS[number],
        kind: 'catalog' | 'registry',
    ) => {
        setError('');
        if (kind === 'catalog') {
            const catalogPreset = preset as typeof CATALOG_PRESETS[number];
            onAddCatalog(catalogPreset.name, catalogPreset.url, catalogPreset.opdsVersion);
            return;
        }
        onAddRegistry(preset.name, preset.url);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose} aria-modal="true" role="dialog">
            <div ref={modalRef} className="theme-surface-elevated theme-border theme-text-primary w-full max-w-lg rounded-lg border p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="theme-accent-text-emphasis text-xl font-bold">Manage Sources</h2>
                    <button onClick={onClose} className="theme-hover-surface rounded-full p-2 transition-colors" aria-label="Close">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="theme-divider mb-6 border-b">
                    <nav className="flex -mb-px gap-4">
                        <button
                            onClick={() => setActiveTab('suggested')}
                            className={`border-b-2 px-2 py-3 text-sm font-medium transition-colors duration-200 ${activeTab === 'suggested'
                                    ? 'theme-accent-border theme-accent-text-emphasis'
                                    : 'theme-text-secondary border-transparent theme-accent-text-emphasis-hover theme-border-hover'
                                }`}
                        >
                            Suggested
                        </button>
                        <button
                            onClick={() => setActiveTab('catalogs')}
                            className={`border-b-2 px-2 py-3 text-sm font-medium transition-colors duration-200 ${activeTab === 'catalogs'
                                    ? 'theme-accent-border theme-accent-text-emphasis'
                                    : 'theme-text-secondary border-transparent theme-accent-text-emphasis-hover theme-border-hover'
                                }`}
                        >
                            Catalogs
                        </button>
                        <button
                            onClick={() => setActiveTab('registries')}
                            className={`border-b-2 px-2 py-3 text-sm font-medium transition-colors duration-200 ${activeTab === 'registries'
                                    ? 'theme-accent-border theme-accent-text-emphasis'
                                    : 'theme-text-secondary border-transparent theme-accent-text-emphasis-hover theme-border-hover'
                                }`}
                        >
                            Registries
                        </button>
                    </nav>
                </div>

                {activeTab === 'suggested' ? (
                    <div className="space-y-6">
                        <div className="theme-surface-muted rounded-lg p-4">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <GlobeIcon className="w-5 h-5" />
                                Suggested Catalogs
                            </h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {CATALOG_PRESETS.map((preset) => {
                                    const alreadyAdded = existingCatalogUrls.has(normalizeUrl(preset.url));

                                    return (
                                        <div key={preset.url} className="theme-surface-elevated theme-border flex items-start justify-between gap-3 rounded-lg border p-3">
                                            <div className="min-w-0">
                                                <div className="theme-text-primary text-sm font-semibold">{preset.name}</div>
                                                <div className="theme-text-secondary text-xs">{preset.description}</div>
                                                <div className="theme-text-muted mt-1 truncate text-[11px]">{preset.url}</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleAddPreset(preset, 'catalog')}
                                                disabled={alreadyAdded}
                                                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                                    alreadyAdded
                                                        ? 'theme-button-neutral cursor-not-allowed opacity-70'
                                                        : 'theme-button-primary'
                                                }`}
                                            >
                                                {alreadyAdded ? 'Added' : 'Quick Add'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="theme-surface-muted rounded-lg p-4">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <GlobeIcon className="w-5 h-5" />
                                Suggested Registries
                            </h3>
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
                                {REGISTRY_PRESETS.map((preset) => {
                                    const alreadyAdded = existingRegistryUrls.has(normalizeUrl(preset.url));

                                    return (
                                        <div key={preset.url} className="theme-surface-elevated theme-border flex items-start justify-between gap-3 rounded-lg border p-3">
                                            <div className="min-w-0">
                                                <div className="theme-text-primary text-sm font-semibold">{preset.name}</div>
                                                <div className="theme-text-secondary text-xs">{preset.description}</div>
                                                <div className="theme-text-muted mt-1 truncate text-[11px]">{preset.url}</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleAddPreset(preset, 'registry')}
                                                disabled={alreadyAdded}
                                                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                                    alreadyAdded
                                                        ? 'theme-button-neutral cursor-not-allowed opacity-70'
                                                        : 'theme-button-primary'
                                                }`}
                                            >
                                                {alreadyAdded ? 'Added' : 'Quick Add'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="theme-surface-muted rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <PlusIcon className="w-5 h-5" />
                            Add New {activeTab === 'catalogs' ? 'Catalog' : 'Registry'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="item-name" className="theme-text-secondary mb-1 block text-sm font-medium">Name</label>
                                <input
                                    id="item-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={activeTab === 'catalogs' ? 'e.g., Project Gutenberg' : 'e.g., OPDS Registry'}
                                    className="theme-input w-full rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="item-url" className="theme-text-secondary mb-1 block text-sm font-medium">URL</label>
                                <input
                                    id="item-url"
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://.../catalog.xml"
                                    className="theme-input w-full rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>
                            {activeTab === 'catalogs' && (
                            <div>
                                <label htmlFor="opds-version" className="theme-text-secondary mb-1 block text-sm font-medium">OPDS Version</label>
                                <select id="opds-version" value={opdsVersion} onChange={(e) => setOpdsVersion(e.target.value as any)} className="theme-input w-full rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                                    <option value="auto">Auto-detect (recommended)</option>
                                    <option value="1">OPDS 1 (Atom/XML)</option>
                                    <option value="2">OPDS 2 (JSON)</option>
                                </select>
                            </div>
                            )}
                            {activeTab === 'registries' && (
                            <p className="theme-text-secondary text-sm">Registries are always OPDS 2.0 (JSON) format.</p>
                            )}
                            {error && <p className="theme-text-danger text-sm">{error}</p>}
                            <button type="submit" className="theme-button-primary w-full rounded-md px-4 py-2 text-sm font-bold transition-colors">
                                Add {activeTab === 'catalogs' ? 'Catalog' : 'Registry'}
                            </button>
                        </form>
                    </div>

                    {/* Existing items list */}
                    <div className="theme-surface-muted rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><GlobeIcon className="w-5 h-5" /> Saved {activeTab === 'catalogs' ? 'Catalogs' : 'Registries'}</h3>
                        {currentList.length > 0 ? (
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {currentList.map(item => (
                                    <li key={item.id} className="theme-surface-elevated flex items-center justify-between gap-2 rounded-md p-2">
                                        {editingItemId === item.id ? (
                                            <>
                                                <label htmlFor={`edit-name-${item.id}`} className="sr-only">Edit name</label>
                                                <input
                                                    id={`edit-name-${item.id}`}
                                                    type="text"
                                                    value={editedName}
                                                    onChange={(e) => setEditedName(e.target.value)}
                                                    className="theme-input w-full rounded-md p-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                    autoFocus
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                                                />
                                                <div className="flex items-center flex-shrink-0">
                                                    <button onClick={handleSaveEdit} className="theme-hover-surface theme-text-success p-2 rounded-full transition-colors" aria-label={`Save changes for ${item.name}`}>
                                                        <CheckIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="theme-hover-surface theme-text-muted p-2 rounded-full transition-colors" aria-label="Cancel editing">
                                                        <CloseIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="truncate">
                                                    <p className="theme-text-primary truncate font-semibold">{item.name}</p>
                                                    <p className="theme-text-secondary truncate text-xs">{item.url}</p>
                                                </div>
                                                <div className="flex items-center flex-shrink-0">
                                                    <button onClick={() => handleStartEdit(item)} className="theme-hover-surface theme-text-muted theme-accent-text-emphasis-hover p-2 rounded-full transition-colors" aria-label={`Edit ${item.name}`}>
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id)} className="theme-hover-surface theme-text-muted theme-text-danger-hover p-2 rounded-full transition-colors" aria-label={`Delete ${item.name}`}>
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="theme-text-secondary py-8 text-center text-sm">No {activeTab === 'catalogs' ? 'catalogs' : 'registries'} added yet.</p>
                        )}
                    </div>
                </div>
                )}
            </div>
        </div>
    );
};

export default ManageCatalogsModal;
