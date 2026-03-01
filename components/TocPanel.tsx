import React, { useState } from 'react';

import './toc-panel.css';
import type { TocItem, Bookmark, Citation, ReaderSettings, BookRecord } from '../types';

import { CloseIcon, ChevronRightIcon, TrashIcon, ExportIcon } from './icons';

interface NavigationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    toc: TocItem[];
    onTocNavigate: (href: string) => void;
    bookmarks: Bookmark[];
    onBookmarkNavigate: (cfi: string) => void;
    onDeleteBookmark: (id: string) => void;
    citations: Citation[];
    onCitationNavigate: (cfi: string) => void;
    onDeleteCitation: (id: string) => void;
    settings: ReaderSettings;
    bookData: BookRecord | null;
}

const getPublicationYear = (pubDate: string | undefined): string => {
    if (!pubDate) return 'n.d.';
    const parsedYear = new Date(pubDate).getFullYear();
    if (!isNaN(parsedYear)) return parsedYear.toString();
    const yearMatch = pubDate.match(/^\d{4}/);
    if (yearMatch) return yearMatch[0];
    return 'n.d.';
};

const formatAuthorName = (authorName: string, format: 'apa' | 'mla' | 'chicago' | 'ris'): string => {
    const words = authorName.split(' ').filter(p => p.trim());
    if (words.length < 2) return authorName;
    const lastName = words.pop()!;
    const firstNameParts = words;
    if (format === 'apa') {
        const initials = firstNameParts.map(name => (name[0] ? `${name[0]}.` : '')).join(' ');
        return `${lastName}, ${initials}`;
    }
    return `${lastName}, ${firstNameParts.join(' ')}`;
};

const generateCitation = (
    book: BookRecord,
    format: 'apa' | 'mla' | 'chicago',
): { pre: string; title: string; post: string; isItalic: boolean } => {
    const author = book.author || 'Unknown Author';
    const title = book.title || 'Untitled Book';
    const publisher = book.publisher || '[Publisher not available]';
    const year = getPublicationYear(book.publicationDate);
    const formattedAuthor = formatAuthorName(author, format as any);

    switch (format) {
        case 'apa':
            return { pre: `${formattedAuthor} (${year}). `, title, post: `. ${publisher}.`, isItalic: true };
        case 'mla':
            return { pre: `${formattedAuthor}. `, title, post: `. ${publisher}, ${year === 'n.d.' ? '[Date not available]' : year}.`, isItalic: true };
        case 'chicago':
            return { pre: `${formattedAuthor}. `, title, post: `. ${publisher}, ${year === 'n.d.' ? '[Date not available]' : year}.`, isItalic: false };
        default:
            return { pre: `${author}. `, title, post: `.`, isItalic: false };
    }
};

const generateRisContent = (book: BookRecord, citations: Citation[]): string => {
    const allRecords: string[] = [];
    const year = getPublicationYear(book.publicationDate);

    citations.forEach(citation => {
        const risRecord: string[] = [];
        risRecord.push('TY  - CHAP');
        if (book.author) risRecord.push(`AU  - ${formatAuthorName(book.author, 'ris')}`);
        if (book.title) risRecord.push(`T2  - ${book.title}`);
        if (book.publisher) risRecord.push(`PB  - ${book.publisher}`);
        if (year !== 'n.d.') risRecord.push(`PY  - ${year}`);
        if (book.isbn) risRecord.push(`SN  - ${book.isbn}`);
        if (citation.chapter) risRecord.push(`TI  - ${citation.chapter}`);
        if (citation.pageNumber) risRecord.push(`SP  - ${citation.pageNumber}`);
        const noteContent = (citation.note || '').replace(/(\r\n|\n|\r)/gm, ' ');
        if (noteContent) risRecord.push(`N1  - ${noteContent}`);
        risRecord.push('ER  - ');
        allRecords.push(risRecord.join('\r\n'));
    });

    return allRecords.join('\r\n\r\n') + '\r\n';
};

const TocListItem: React.FC<{ item: TocItem; onNavigate: (href: string) => void; level: number }> = ({ item, onNavigate, level }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasSubitems = !!(item.subitems && item.subitems.length > 0);

    const isTopLevel = level === 0;
    const typographyClasses = isTopLevel ? 'font-semibold theme-text-primary' : 'font-normal theme-text-secondary';
    const hoverClasses = 'hover:bg-sky-500/10';

    return (
        <li>
            <div className={`flex items-center justify-between w-full py-2 pr-3 ${hoverClasses}`} data-level={level}>
                <button
                    onClick={() => { if (item.href) onNavigate(item.href); }}
                    className={`flex-1 text-left ${typographyClasses} group-hover:text-sky-300 transition-colors focus:outline-none`}
                    aria-label={`Go to ${item.label}`}
                >
                    {item.label.trim()}
                </button>
                {hasSubitems && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                        className="theme-hover-surface ml-2 rounded p-1"
                    >
                        <ChevronRightIcon className={`w-4 h-4 text-slate-500 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                )}
            </div>

            {hasSubitems && (
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px]' : 'max-h-0'}`}>
                    <ul className="pt-1">
                        {item.subitems!.map(subitem => (
                            <TocListItem key={subitem.id} item={subitem} onNavigate={onNavigate} level={level + 1} />
                        ))}
                    </ul>
                </div>
            )}
        </li>
    );
};

const TocPanel: React.FC<NavigationPanelProps> = ({
    isOpen,
    onClose,
    toc,
    onTocNavigate,
    bookmarks,
    onBookmarkNavigate,
    onDeleteBookmark,
    citations,
    onCitationNavigate,
    onDeleteCitation,
    settings,
    bookData,
}) => {
    const [activeTab, setActiveTab] = useState<'toc' | 'bookmarks' | 'citations'>('toc');

    const handleExportCitations = () => {
        if (!bookData || citations.length === 0) return;
        const risContent = generateRisContent(bookData, citations);
        const blob = new Blob([risContent], { type: 'application/x-research-info-systems;charset=utf-8' });
        const safeTitle = (bookData.title || 'book').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${safeTitle}_citations.ris`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-30" onClick={onClose} aria-hidden="true" />
            <div
                className={`theme-surface-elevated theme-border theme-text-primary fixed top-0 left-0 z-40 flex h-full w-80 transform flex-col border-r shadow-2xl transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="nav-heading"
            >
                <div className="theme-divider flex shrink-0 items-center justify-between border-b p-4">
                    <h3 id="nav-heading" className="theme-text-primary text-xl font-semibold">Navigation</h3>
                    <button onClick={onClose} className="theme-hover-surface rounded-full p-2" aria-label="Close navigation panel">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="theme-divider shrink-0 border-b px-2">
                    <nav className="flex -mb-px">
                        <button
                            onClick={() => setActiveTab('toc')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                                activeTab === 'toc' ? 'border-sky-400 text-sky-300' : 'theme-text-secondary border-transparent hover:text-sky-400 hover:border-slate-500'
                            }`}
                            aria-current={activeTab === 'toc' ? 'page' : undefined}
                        >
                            Contents
                        </button>
                        <button
                            onClick={() => setActiveTab('bookmarks')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                                activeTab === 'bookmarks' ? 'border-sky-400 text-sky-300' : 'theme-text-secondary border-transparent hover:text-sky-400 hover:border-slate-500'
                            }`}
                            aria-current={activeTab === 'bookmarks' ? 'page' : undefined}
                        >
                            Bookmarks
                        </button>
                        <button
                            onClick={() => setActiveTab('citations')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                                activeTab === 'citations' ? 'border-sky-400 text-sky-300' : 'theme-text-secondary border-transparent hover:text-sky-400 hover:border-slate-500'
                            }`}
                            aria-current={activeTab === 'citations' ? 'page' : undefined}
                        >
                            Citations
                        </button>
                    </nav>
                </div>

                <div className="overflow-y-auto flex-grow">
                    {activeTab === 'toc' && (
                        <div className="p-4">
                            {toc.length > 0 ? (
                                <ul className="space-y-1">
                                    {toc.map(item => (
                                        <TocListItem key={item.id} item={item} onNavigate={onTocNavigate} level={0} />
                                    ))}
                                </ul>
                            ) : (
                                <p className="theme-text-secondary p-4 text-center">No table of contents available.</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'bookmarks' && (
                        <div>
                            {bookmarks.length > 0 ? (
                                <ul className="theme-divider divide-y">
                                    {bookmarks.sort((a, b) => a.createdAt - b.createdAt).map(bookmark => (
                                        <li key={bookmark.id} className="p-4 flex items-center justify-between group">
                                            <button onClick={() => onBookmarkNavigate(bookmark.cfi)} className="flex-grow text-left pr-4">
                                                {bookmark.chapter && (
                                                    <span className="block text-xs font-semibold text-sky-400 uppercase tracking-wider mb-1">{bookmark.chapter}</span>
                                                )}
                                                <span className="theme-text-primary block text-sm font-semibold transition-colors group-hover:text-sky-300">{bookmark.label}</span>
                                                {bookmark.description && (
                                                    <blockquote className="theme-border mt-2 border-l-2 pl-3">
                                                        <p className="theme-text-secondary text-sm italic">{bookmark.description}</p>
                                                    </blockquote>
                                                )}
                                                <span className="theme-text-muted mt-2 block text-xs">{new Date(bookmark.createdAt).toLocaleString()}</span>
                                            </button>
                                            <button onClick={() => onDeleteBookmark(bookmark.id)} className="p-2 rounded-full hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0" aria-label={`Delete bookmark: ${bookmark.label}`}>
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="theme-text-secondary p-8 text-center">You haven't added any bookmarks yet.</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'citations' && (
                        <div>
                            {bookData && citations.length > 0 && (
                                <div className="theme-divider border-b p-4">
                                    <button onClick={handleExportCitations} className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-sky-500 hover:bg-sky-600 transition-colors font-semibold text-white text-sm">
                                        <ExportIcon className="w-5 h-5" />
                                        <span>Export Citations (.ris)</span>
                                    </button>
                                </div>
                            )}

                            {citations.length > 0 && bookData ? (
                                <ul className="theme-divider divide-y">
                                    {citations.sort((a, b) => a.createdAt - b.createdAt).map(citation => {
                                        const citationParts = generateCitation(bookData, settings.citationFormat);
                                        return (
                                            <li key={citation.id} className="p-4 flex items-center justify-between group">
                                                <button onClick={() => onCitationNavigate(citation.cfi)} className="flex-grow text-left pr-4">
                                                    {citation.chapter && (
                                                        <span className="block text-xs font-semibold text-sky-400 uppercase tracking-wider mb-1">{citation.chapter}</span>
                                                    )}
                                                    <p className="theme-text-primary text-sm transition-colors group-hover:text-sky-300">
                                                        {citationParts.pre}
                                                        <span className={`${citationParts.isItalic ? 'italic' : 'not-italic'} theme-text-secondary group-hover:text-sky-400`}>{citationParts.title}</span>
                                                        {citationParts.post}
                                                    </p>
                                                    {citation.note && (
                                                        <blockquote className="theme-border mt-2 border-l-2 pl-3">
                                                            <p className="theme-text-secondary text-sm italic">"{citation.note}"</p>
                                                        </blockquote>
                                                    )}
                                                    <div className="theme-text-muted mt-2 flex items-center justify-between text-xs">
                                                        <span>{new Date(citation.createdAt).toLocaleString()}</span>
                                                        {citation.pageNumber && (
                                                            <span className="theme-surface rounded px-1.5 py-0.5 font-semibold">p. {citation.pageNumber}</span>
                                                        )}
                                                    </div>
                                                </button>
                                                <button onClick={() => onDeleteCitation(citation.id)} className="p-2 rounded-full hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0" aria-label={`Delete citation`}>
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="theme-text-secondary p-8 text-center">You haven't created any citations yet.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default TocPanel;
