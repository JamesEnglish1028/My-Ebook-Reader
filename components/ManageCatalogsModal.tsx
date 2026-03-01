import React, { useState } from 'react';

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
    const [activeTab, setActiveTab] = useState<'catalogs' | 'registries'>('catalogs');

    const modalRef = useFocusTrap<HTMLDivElement>({
        isActive: isOpen,
        onEscape: onClose,
    });

    if (!isOpen) return null;

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
        } else {
            onAddRegistry(name, url);
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
        } else {
            onUpdateRegistry(editingItemId, editedName.trim());
        }
        handleCancelEdit();
    };

    const currentList = activeTab === 'catalogs' ? catalogs : registries;
    const handleDelete = activeTab === 'catalogs' ? onDeleteCatalog : onDeleteRegistry;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose} aria-modal="true" role="dialog">
            <div ref={modalRef} className="theme-surface-elevated theme-border theme-text-primary w-full max-w-lg rounded-lg border p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-sky-300">Manage Sources</h2>
                    <button onClick={onClose} className="theme-hover-surface rounded-full p-2 transition-colors" aria-label="Close">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="border-b border-slate-700 mb-6 theme-divider">
                    <nav className="flex -mb-px gap-4">
                        <button
                            onClick={() => setActiveTab('catalogs')}
                            className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === 'catalogs'
                                    ? 'border-sky-400 text-sky-300'
                                    : 'theme-text-secondary border-transparent hover:border-slate-500 hover:text-sky-400'
                                }`}
                        >
                            Catalogs
                        </button>
                        <button
                            onClick={() => setActiveTab('registries')}
                            className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === 'registries'
                                    ? 'border-sky-400 text-sky-300'
                                    : 'theme-text-secondary border-transparent hover:border-slate-500 hover:text-sky-400'
                                }`}
                        >
                            Registries
                        </button>
                    </nav>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Add new form */}
                    <div className="bg-slate-900/50 p-4 rounded-lg theme-surface-muted">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <PlusIcon className="w-5 h-5" />
                            Add New {activeTab === 'catalogs' ? 'Catalog' : 'Registry'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="item-name" className="block text-sm font-medium text-slate-400 mb-1 theme-text-secondary">Name</label>
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
                                <label htmlFor="item-url" className="block text-sm font-medium text-slate-400 mb-1 theme-text-secondary">URL</label>
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
                                <label htmlFor="opds-version" className="block text-sm font-medium text-slate-400 mb-1 theme-text-secondary">OPDS Version</label>
                                <select id="opds-version" value={opdsVersion} onChange={(e) => setOpdsVersion(e.target.value as any)} className="theme-input w-full rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                                    <option value="auto">Auto-detect (recommended)</option>
                                    <option value="1">OPDS 1 (Atom/XML)</option>
                                    <option value="2">OPDS 2 (JSON)</option>
                                </select>
                            </div>
                            )}
                            {activeTab === 'registries' && (
                            <p className="text-sm text-slate-400 theme-text-secondary">Registries are always OPDS 2.0 (JSON) format.</p>
                            )}
                            {error && <p className="text-sm text-red-400">{error}</p>}
                            <button type="submit" className="w-full py-2 px-4 rounded-md bg-sky-500 hover:bg-sky-600 transition-colors font-bold text-sm">
                                Add {activeTab === 'catalogs' ? 'Catalog' : 'Registry'}
                            </button>
                        </form>
                    </div>

                    {/* Existing items list */}
                    <div className="bg-slate-900/50 p-4 rounded-lg theme-surface-muted">
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
                                                    <button onClick={handleSaveEdit} className="p-2 rounded-full hover:bg-green-500/20 text-green-400 transition-colors" aria-label={`Save changes for ${item.name}`}>
                                                        <CheckIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="p-2 rounded-full hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors theme-text-muted" aria-label="Cancel editing">
                                                        <CloseIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="truncate">
                                                    <p className="font-semibold text-slate-200 truncate theme-text-primary">{item.name}</p>
                                                    <p className="text-xs text-slate-400 truncate theme-text-secondary">{item.url}</p>
                                                </div>
                                                <div className="flex items-center flex-shrink-0">
                                                    <button onClick={() => handleStartEdit(item)} className="p-2 rounded-full hover:bg-sky-500/20 text-slate-500 hover:text-sky-400 transition-colors theme-text-muted" aria-label={`Edit ${item.name}`}>
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id)} className="p-2 rounded-full hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors theme-text-muted" aria-label={`Delete ${item.name}`}>
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-400 text-center py-8 theme-text-secondary">No {activeTab === 'catalogs' ? 'catalogs' : 'registries'} added yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageCatalogsModal;
