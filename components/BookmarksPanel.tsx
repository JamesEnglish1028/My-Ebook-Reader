import React from 'react';

export interface Bookmark {
	id: string;
	label: string;
	cfi: string;
	created: string;
}

interface BookmarksPanelProps {
	bookmarks: Bookmark[];
	onNavigate: (cfi: string) => void;
	onDelete: (id: string) => void;
	isOpen: boolean;
	onClose: () => void;
}

const BookmarksPanel: React.FC<BookmarksPanelProps> = ({ bookmarks, onNavigate, onDelete, isOpen, onClose }) => {
	if (!isOpen) return null;
	return (
		<aside
			className="theme-surface-elevated theme-border theme-text-primary fixed top-0 right-0 z-40 flex h-full w-80 transform flex-col border-l shadow-2xl transition-transform duration-300 ease-in-out"
			role="dialog"
			aria-modal="true"
			aria-labelledby="bookmarks-heading"
		>
			<div className="theme-divider flex shrink-0 items-center justify-between border-b p-4">
				<h3 id="bookmarks-heading" className="theme-text-primary text-xl font-semibold">Bookmarks</h3>
				<button onClick={onClose} aria-label="Close bookmarks panel" className="theme-hover-surface rounded-full p-2">
					<span aria-hidden>×</span>
				</button>
			</div>
			<div className="grow overflow-y-auto p-4">
				{bookmarks.length === 0 ? (
					<div className="theme-text-secondary text-center">No bookmarks yet.</div>
				) : (
					<ul className="space-y-2">
						{bookmarks.map(bm => (
							<li key={bm.id} className="theme-surface flex items-center justify-between rounded p-2">
								<button
									className="theme-text-primary flex-1 text-left hover:underline"
									onClick={() => onNavigate(bm.cfi)}
									aria-label={`Go to bookmark: ${bm.label}`}
								>
									<div className="font-medium">{bm.label}</div>
									<div className="theme-text-muted text-xs">{new Date(bm.created).toLocaleString()}</div>
								</button>
								<button
									className="theme-text-muted ml-2 rounded p-2 hover:bg-red-500/20 hover:text-red-400"
									onClick={() => onDelete(bm.id)}
									aria-label={`Delete bookmark: ${bm.label}`}
								>
									🗑️
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</aside>
	);
};

export default BookmarksPanel;
