import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';

import { useParams, useNavigate } from 'react-router-dom';

import { db } from '../services/db';
import { getReaderSettings, getBookmarksForBook, getCitationsForBook, saveBookmarksForBook, saveCitationsForBook, getLastPositionForBook, saveLastPositionForBook , getPdfViewStateForBook, savePdfViewStateForBook } from '../services/readerUtils';
import type { BookRecord , TocItem, Bookmark, Citation, ReaderSettings } from '../types';

import AddedHud from './AddedHud';
import BookmarkModal from './BookmarkModal';
import CitationModal from './CitationModal';
import { useConfirm } from './ConfirmContext';
import { CloseIcon, LeftArrowIcon, RightArrowIcon, ListIcon, BookmarkIcon, AcademicCapIcon } from './icons';
import ShortcutHelpModal from './ShortcutHelpModal';
import Spinner from './Spinner';
import TocPanel from './TocPanel';
import ZoomHud from './ZoomHud';
// Lazy-load react-pdf to keep initial bundle small
// Importing the package entry dynamically; react-pdf exposes Document and Page components.
const PDFDocument = React.lazy(() => import('react-pdf').then(m => ({ default: m.Document })));
const PDFPage = React.lazy(() => import('react-pdf').then(m => ({ default: m.Page })));

// Statically import the worker via Vite's ?url so it's served with correct MIME
// Use the .mjs worker that exists in the installed pdfjs-dist package
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure pdfjs worker for Vite using import.meta.url
// pdfjs-dist exposes the worker file at 'pdf.worker.min.js' in the package

interface PdfReaderViewProps {
  bookId?: number; // optional: if not provided, read from route params
  onClose?: () => void;
}

const PdfReaderView: React.FC<PdfReaderViewProps> = ({ bookId: propBookId, onClose: propOnClose }) => {
  const params = useParams();
  const navigate = useNavigate();
  const bookId = propBookId ?? (params.id ? Number(params.id) : null);
  const onClose = propOnClose ?? (() => navigate('/'));
  const [bookData, setBookData] = useState<BookRecord | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [fitMode, setFitMode] = useState<'page' | 'width'>('page');
  const [showZoomHud, setShowZoomHud] = useState(false);
  const zoomHudTimerRef = React.useRef<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [pdfToc, setPdfToc] = useState<TocItem[]>([]);
  const [pdfChapterMap, setPdfChapterMap] = useState<Record<number, string>>({});
  const [addedHudMessage, setAddedHudMessage] = useState<string | null>(null);
  const addedHudTimerRef = React.useRef<number | null>(null);
  const [showNavPanel, setShowNavPanel] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [showCitationModal, setShowCitationModal] = useState(false);
  const confirm = useConfirm();
  const [tocLoading, setTocLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [settings, setSettings] = useState<ReaderSettings>(getReaderSettings);
  const [showIframeFallback, setShowIframeFallback] = useState(false);
  const [blobSize, setBlobSize] = useState<number | null>(null);
  const savePageTimeoutRef = React.useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measuredWidthRef = useRef<number | null>(null);
  const pdfViewStateLoadedRef = useRef(false);

  useEffect(() => {
    // Configure pdfjs worker at runtime so pdfjs-dist is only loaded when the viewer mounts
    let workerConfigured = false;
    (async () => {
      try {
        // Prefer using react-pdf's exported pdfjs instance so config aligns with the viewer.
        const reactPdf = await import('react-pdf');
        try {
          // Use the statically resolved worker URL provided by Vite
          // @ts-ignore
          reactPdf.pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
          workerConfigured = true;
        } catch (inner) {
          console.warn('Could not set worker via static pdfWorkerUrl', inner);
        }
        if (!workerConfigured) {
          const pdfjs = await import('pdfjs-dist');
          // @ts-ignore
          pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
          workerConfigured = true;
        }
      } catch (err) {
        console.warn('Could not configure pdfjs worker dynamically', err);
        setShowIframeFallback(true);
      }
    })();

    let objectUrl: string | null = null;

  const fetchBookData = async () => {
      setIsLoading(true);
      setError(null);
      setPdfUrl(null);

      try {
        console.debug('[PdfReaderView] fetching book id=', bookId);
        const data = await db.getBook(bookId as number);
        if (!data) {
          // Provide diagnostics: list available book ids for easier debugging
          try {
            const all = await db.getAllBooks();
            const ids = all.map(b => b.id).filter(Boolean);
            throw new Error(`Could not find this book in your library (requested id: ${bookId}). Available book ids: ${ids.join(', ') || 'none'}`);
          } catch (inner) {
            throw new Error(`Could not find this book in your library (requested id: ${bookId}).`);
          }
        }
        if (data.format !== 'PDF') {
          throw new Error('The selected book is not in PDF format.');
        }

  setBookData(data);
        
        // Convert the ArrayBuffer from the DB into a Blob, then create a local URL for it.
        // This is the most reliable way to pass local data to an iframe.
        const blob = new Blob([data.epubData], { type: 'application/pdf' });
  objectUrl = URL.createObjectURL(blob);
  console.debug('[PdfReaderView] created objectUrl', objectUrl, 'blob size', blob.size);
  setBlobSize(blob.size);
  setPdfUrl(objectUrl);

      } catch (e) {
        console.error('[PdfReaderView] fetchBookData error', e);
        setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookData();

    // This cleanup function is crucial to revoke the created object URL and prevent memory leaks.
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [bookId]);

  // Handler for when react-pdf loads document metadata (number of pages)
  const onDocumentLoadSuccess = (pdf: any) => {
    setNumPages(pdf.numPages || null);
    setCurrentPage(1);

    // Fetch and map outline (table of contents)
  (async () => {
      try {
        setTocLoading(true);
        const outline = await pdf.getOutline();
        if (!outline || outline.length === 0) {
          setPdfToc([]);
          return;
        }

        let idCounter = 0;
        const mapNode = async (node: any, depth = 0): Promise<TocItem | null> => {
          if (!node) return null;
          const title = node.title || 'Untitled';
          let pageNumber: number | null = null;

          try {
            let dest = node.dest;
            if (typeof dest === 'string') {
              dest = await pdf.getDestination(dest);
            }
            if (Array.isArray(dest) && dest.length > 0) {
              try {
                const pageIndex = await pdf.getPageIndex(dest[0]);
                pageNumber = pageIndex + 1;
              } catch (e) {
                // ignore resolution errors
              }
            }
          } catch (e) {
            // ignore
          }

          const children = [] as TocItem[];
          if (node.items && node.items.length > 0) {
            for (const child of node.items) {
              const mapped = await mapNode(child, depth + 1);
              if (mapped) children.push(mapped);
            }
          }

          const id = `pdf-toc-${idCounter++}`;
          return { id, label: title, href: pageNumber ? `page:${pageNumber}` : '', subitems: children } as TocItem;
        };

        const mapped: TocItem[] = [];
        for (const node of outline) {
          const m = await mapNode(node, 0);
          if (m) mapped.push(m);
        }

        setPdfToc(mapped);
        // Build a page->chapter map so we can label bookmarks/citations by chapter when possible
        try {
          // Improved resolution: for each toc item, try to resolve its destination to a page index
          const flat: { page: number; label: string }[] = [];
          const walk = async (items: TocItem[]) => {
            for (const it of items) {
              if (it.href) {
                // href might be like 'page:N' or other forms; attempt to parse
                if (it.href.startsWith('page:')) {
                  const p = Number(it.href.split(':')[1]);
                  if (!isNaN(p) && p >= 1) flat.push({ page: p, label: it.label });
                } else {
                  // Try to resolve named destination via pdf.getDestination
                  try {
                    const dest = await pdf.getDestination(it.href as any);
                    if (Array.isArray(dest) && dest.length > 0) {
                      try {
                        const pageIndex = await pdf.getPageIndex(dest[0]);
                        flat.push({ page: pageIndex + 1, label: it.label });
                      } catch (e) {
                        // ignore
                      }
                    }
                  } catch (e) {
                    // ignore resolution errors
                  }
                }
              }
              if (it.subitems && it.subitems.length > 0) await walk(it.subitems);
            }
          };
          await walk(mapped);
          flat.sort((a, b) => a.page - b.page);
          const map: Record<number, string> = {};
          for (let i = 0; i < flat.length; i++) {
            const start = flat[i].page;
            const end = (i + 1 < flat.length) ? flat[i + 1].page - 1 : (pdf.numPages || start);
            for (let p = start; p <= end; p++) {
              map[p] = flat[i].label;
            }
          }
          setPdfChapterMap(map);
        } catch (e) {
          console.warn('Failed to build pdf chapter map', e);
        }
      } catch (e) {
        console.warn('Failed to map PDF outline', e);
        setPdfToc([]);
      } finally {
        setTocLoading(false);
      }
    })();

    // Restore last-read page for PDFs if available
    try {
      const last = getLastPositionForBook(bookData?.id ?? (bookId as number));
      if (last && typeof last === 'string' && last.startsWith('page:')) {
        const p = Number(last.split(':')[1]);
        if (!isNaN(p) && p >= 1) setCurrentPage(p);
      }
    } catch (e) {
      // ignore
    }

    // Restore zoom/fit state for this book (only once)
    try {
      if (bookData?.id && !pdfViewStateLoadedRef.current) {
        const vs = getPdfViewStateForBook(bookData.id);
        if (vs && typeof vs.zoomPercent === 'number') setZoomPercent(vs.zoomPercent);
        if (vs && vs.fitMode === 'width') setFitMode('width');
        pdfViewStateLoadedRef.current = true;
      }
    } catch (e) {
      // ignore
    }
  };

  const goToNext = () => {
    if (!numPages) return;
    setCurrentPage(p => Math.min(numPages, p + 1));
  };

  const goToPrev = () => {
    setCurrentPage(p => Math.max(1, p - 1));
  };

  const handleTocNavigate = (href: string) => {
    if (!href) return;
    if (href.startsWith('page:')) {
      const p = Number(href.split(':')[1]);
      if (!isNaN(p) && p >= 1) setCurrentPage(p);
    } else if (!isNaN(Number(href))) {
      setCurrentPage(Number(href));
    }
    setShowNavPanel(false);
  };

  // Persist current page for PDF (debounced)
  React.useEffect(() => {
    if (!bookData?.id) return;
    if (savePageTimeoutRef.current) {
      clearTimeout(savePageTimeoutRef.current);
    }
    // Capture the ID at the time of scheduling to prevent race conditions
    const bookId = bookData.id;
    savePageTimeoutRef.current = window.setTimeout(() => {
      try {
        saveLastPositionForBook(bookId, `page:${currentPage}`);
      } catch (e) {
        console.warn('Failed to save last PDF position', e);
      }
    }, 800);

    return () => {
      if (savePageTimeoutRef.current) {
        clearTimeout(savePageTimeoutRef.current);
        savePageTimeoutRef.current = null;
      }
    };
  }, [currentPage, bookData]);

  // Persist view state (zoom/fit) when it changes
  useEffect(() => {
    if (!bookData?.id) return;
    try {
      savePdfViewStateForBook(bookData.id, { zoomPercent, fitMode });
    } catch (e) {
      console.warn('Failed to persist pdf view state', e);
    }
    // show HUD when zoom or fit changes
    setShowZoomHud(true);
    if (zoomHudTimerRef.current) clearTimeout(zoomHudTimerRef.current);
    zoomHudTimerRef.current = window.setTimeout(() => setShowZoomHud(false), 1200);
  }, [zoomPercent, fitMode, bookData]);

  // Measure container width for fit-to-width behavior
  const measureWidth = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.getBoundingClientRect().width;
    measuredWidthRef.current = w;
  }, []);

  useEffect(() => {
    measureWidth();
    const ro = new ResizeObserver(() => measureWidth());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measureWidth]);

  // Keyboard shortcuts for PDF reader (zoom, fit, help)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement && (document.activeElement as HTMLElement).tagName;
      if (active === 'INPUT' || active === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === ' ') {
        e.preventDefault();
        goToNext();
      } else if (e.key === '+' || (e.key === '=' && e.shiftKey)) {
        // zoom in
        setZoomPercent(z => Math.min(400, Math.round(z * 1.15)));
      } else if (e.key === '-' || e.key === '_') {
        setZoomPercent(z => Math.max(20, Math.round(z / 1.15)));
      } else if (e.key.toLowerCase() === 'f') {
        setFitMode(m => m === 'page' ? 'width' : 'page');
      } else if (e.key === '?') {
        setShowHelp(s => !s);
      } else if (e.key.toLowerCase() === 'c') {
        setShowNavPanel(s => !s);
      } else if (e.key.toLowerCase() === 'b') {
        // Add a lightweight bookmark (page-based)
        if (!bookData?.id) return;
        const newBookmark: Bookmark = {
          id: new Date().toISOString(),
          cfi: `page:${currentPage}`,
          label: `Page ${currentPage}`,
          chapter: undefined,
          description: undefined,
          createdAt: Date.now(),
        };
        const updated = [...bookmarks, newBookmark];
        setBookmarks(updated);
        try { saveBookmarksForBook(bookData.id, updated); } catch (err) { console.warn(err); }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goToPrev, goToNext, bookData, currentPage, bookmarks]);
  

  useEffect(() => {
    if (!bookData || !bookData.id) return;
    try {
      const b = getBookmarksForBook(bookData.id);
      const c = getCitationsForBook(bookData.id);
      setBookmarks(b || []);
      setCitations(c || []);
    } catch (e) {
      console.warn('Failed to load bookmarks/citations for PDF', e);
    }
  }, [bookData]);

  // Save a bookmark created via the modal (with optional note)
  const handleSaveBookmark = async (note: string) => {
    if (!bookData?.id) return;
    // Duplicate detection: don't allow an identical bookmark unless user confirms
    const exists = bookmarks.some(b => b.cfi === `page:${currentPage}`);
    if (exists) {
      try {
        const ok = await confirm({ message: 'A bookmark already exists for this page. Add another?' });
        if (!ok) return;
      } catch (e) {
        return;
      }
    }
    const newBookmark = {
      id: new Date().toISOString(),
      cfi: `page:${currentPage}`,
      label: `Page ${currentPage}`,
      chapter: pdfChapterMap[currentPage] || undefined,
      description: note || undefined,
      createdAt: Date.now(),
    } as any;
    const updated = [...bookmarks, newBookmark];
    setBookmarks(updated);
    try { saveBookmarksForBook(bookData.id, updated); } catch (e) { console.warn(e); }
    setShowBookmarkModal(false);
    // show added HUD
    setAddedHudMessage('Bookmark added');
    if (addedHudTimerRef.current) clearTimeout(addedHudTimerRef.current);
    addedHudTimerRef.current = window.setTimeout(() => setAddedHudMessage(null), 1400);
  };

  // Save a citation created via the modal (with optional note)
  const handleSaveCitation = async (note: string) => {
    if (!bookData?.id) return;
    // Duplicate detection: check if a citation already exists for this page & note
    const exists = citations.some(c => c.pageNumber === currentPage && ((c.note || '') === (note || '')));
    if (exists) {
      try {
        const ok = await confirm({ message: 'An identical citation already exists for this page. Add another?' });
        if (!ok) return;
      } catch (e) {
        return;
      }
    }
    const newCitation = {
      id: new Date().toISOString(),
      cfi: `page:${currentPage}`,
      note: note || undefined,
      createdAt: Date.now(),
      pageNumber: currentPage,
      chapter: pdfChapterMap[currentPage] || undefined,
    } as any;
    const updated = [...citations, newCitation];
    setCitations(updated);
    try { saveCitationsForBook(bookData.id, updated); } catch (e) { console.warn(e); }
    setShowCitationModal(false);
    // show added HUD
    setAddedHudMessage('Citation added');
    if (addedHudTimerRef.current) clearTimeout(addedHudTimerRef.current);
    addedHudTimerRef.current = window.setTimeout(() => setAddedHudMessage(null), 1400);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner text="Loading PDF..." />
        </div>
      );
    }

    if (error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="theme-surface-elevated theme-border theme-text-primary mx-auto max-w-lg rounded-lg border p-8 text-center shadow-lg">
              <h3 className="text-xl font-bold text-red-300 mb-2">Could Not Open PDF</h3>
              <p className="theme-text-secondary">{error}</p>
          </div>
        </div>
      );
    }

    if (pdfUrl) {
      // Prefer the DOM-based react-pdf viewer but keep an iframe fallback for robustness.
      return (
        <div className="w-full h-full flex flex-col">

          <div ref={containerRef} className="flex-grow relative overflow-auto p-4 md:p-8 theme-surface">
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><Spinner text="Loading viewer..."/></div>}>
              <div className="w-full max-w-[1100px] mx-auto">
                <div className="theme-text-secondary mb-2 flex items-center justify-between text-sm">
                  <div>Size: {blobSize ? `${(blobSize/1024).toFixed(1)} KB` : 'unknown'}</div>
                  {pdfUrl && (
                    <div className="flex items-center gap-2">
                      <a href={pdfUrl} target="_blank" rel="noreferrer" className="underline">Open raw PDF</a>
                      <a href={pdfUrl} download={bookData?.title ? `${bookData.title}.pdf` : 'book.pdf'} className="underline">Download</a>
                    </div>
                  )}
                </div>
                <PDFDocument file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={(e: any) => { console.error('PDF load error', e); setError('Failed to load PDF file (viewer). The file may be corrupted or unsupported.'); setShowIframeFallback(true); }}>
                  {/* Render only the current page to save memory; compute width/scale based on fitMode and measured container */}
                  {(() => {
                    // choose width based on fitMode and zoomPercent
                    const containerW = measuredWidthRef.current || 900;
                    if (fitMode === 'width') {
                      const padding = 32; // approximate padding from p-8
                      const target = Math.max(200, Math.floor(containerW - padding));
                      return (
                        <PDFPage pageNumber={currentPage} width={target} onLoadError={(e: any) => { console.error('PDF page load error', e); setError('Failed to render PDF page. Showing fallback.'); setShowIframeFallback(true); }} />
                      );
                    }
                    const base = 900;
                    const scaled = Math.max(200, Math.floor((zoomPercent / 100) * base));
                    return (
                      <PDFPage pageNumber={currentPage} width={scaled} onLoadError={(e: any) => { console.error('PDF page load error', e); setError('Failed to render PDF page. Showing fallback.'); setShowIframeFallback(true); }} />
                    );
                  })()}
                </PDFDocument>
              </div>
            </Suspense>

            {/* The iframe fallback is kept but hidden by default; if the DOM viewer errors we can show it instead. */}
            {showIframeFallback ? (
              <iframe
                src={pdfUrl}
                title={bookData?.title || 'PDF Viewer'}
                className="w-full h-full border-0"
                aria-hidden="false"
              />
            ) : (
              <iframe
                src={pdfUrl}
                title={bookData?.title || 'PDF Viewer'}
                className="w-full h-full border-0 hidden"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Footer controls to mirror EPUB reader layout */}
          <footer className="theme-surface-elevated theme-border theme-text-primary z-20 flex shrink-0 items-center gap-4 border-t p-4">
            <div className="flex items-center gap-2">
              <button onClick={goToPrev} className="theme-hover-surface p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Previous page" disabled={currentPage <= 1}><LeftArrowIcon className="w-5 h-5"/></button>
              <button onClick={goToNext} className="theme-hover-surface p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Next page" disabled={numPages !== null && currentPage >= numPages}><RightArrowIcon className="w-5 h-5"/></button>
            </div>

            <div className="flex-grow flex flex-col justify-center">
              <input
                type="range"
                min="1"
                max={numPages || 1}
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                aria-label="PDF progress"
                disabled={!numPages}
              />
              <div className="theme-text-secondary mt-2 text-center text-sm" aria-live="polite">
                {numPages ? (
                  <span>Page {currentPage} of {numPages}</span>
                ) : (
                  <span className="theme-text-muted">Loading pages...</span>
                )}
              </div>
            </div>

            <div className="flex w-28 flex-col items-center text-sm">
              <label className="theme-text-secondary text-xs">Go to</label>
              <input
                type="number"
                min={1}
                max={numPages || 9999}
                value={currentPage || ''}
                onChange={(e) => {
                  const v = parseInt(e.target.value || '1', 10);
                  if (isNaN(v) || v < 1) return;
                  setCurrentPage(Math.min(numPages || v, Math.max(1, v)));
                }}
                className="theme-input w-full rounded-md px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Jump to page"
              />
            </div>
          </footer>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col select-none">
      <ZoomHud value={fitMode === 'page' ? `${zoomPercent}%` : `Fit: ${fitMode}`} isOpen={showZoomHud} />
      <AddedHud message={addedHudMessage || ''} isOpen={!!addedHudMessage} />
      <header className="flex items-center justify-between p-2 bg-slate-800 shadow-md z-20 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Close Reader">
            <CloseIcon className="w-6 h-6" />
          </button>
          <button onClick={() => setShowNavPanel(true)} className="p-2 rounded-full hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Contents and Bookmarks">
            <ListIcon className="w-6 h-6" />
            {(bookmarks.length > 0 || citations.length > 0) && (
              <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-sky-400 ring-2 ring-slate-800" />
            )}
          </button>
        </div>
        <div className="text-center truncate px-2">
          <h2 className="text-lg font-bold">{bookData?.title || 'PDF Reader'}</h2>
          <p className="text-sm text-slate-400">{bookData?.author}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            <button onClick={() => setZoomPercent(z => Math.max(20, Math.round(z / 1.15)))} className="p-2 rounded hover:bg-slate-700" aria-label="Zoom out">-</button>
            <div className="text-sm text-slate-300 px-2">{zoomPercent}%</div>
            <button onClick={() => setZoomPercent(z => Math.min(400, Math.round(z * 1.15)))} className="p-2 rounded hover:bg-slate-700" aria-label="Zoom in">+</button>
      <button onClick={() => setFitMode(m => m === 'page' ? 'width' : 'page')} className="p-2 rounded hover:bg-slate-700" aria-label="Toggle fit mode">{fitMode === 'page' ? 'Fit Page' : 'Fit Width'}</button>
      <button onClick={() => setShowCitationModal(true)} className="p-2 rounded-full hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Create citation for this page">
        <AcademicCapIcon className="w-6 h-6" />
      </button>
      <button onClick={() => setShowBookmarkModal(true)} className="p-2 rounded-full hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Add bookmark to this page">
        <BookmarkIcon className="w-6 h-6" />
      </button>
      <button onClick={() => setShowHelp(s => !s)} className="p-2 rounded hover:bg-slate-700" aria-label="Keyboard help">?</button>
          </div>
        </div>
      </header>

      <main className="flex-grow relative min-h-0 bg-slate-800/50">
        {renderContent()}
      </main>
        <TocPanel
          isOpen={showNavPanel}
          onClose={() => setShowNavPanel(false)}
          toc={pdfToc}
          onTocNavigate={handleTocNavigate}
          bookmarks={bookmarks}
          onBookmarkNavigate={(pageHref: string) => {
            handleTocNavigate(pageHref);
          }}
          onDeleteBookmark={(id: string) => {
            const updated = bookmarks.filter(b => b.id !== id);
            setBookmarks(updated);
            if (bookData?.id) saveBookmarksForBook(bookData.id, updated);
          }}
          citations={citations}
          onCitationNavigate={(pageHref: string) => {
            handleTocNavigate(pageHref);
          }}
          onDeleteCitation={(id: string) => {
            const updated = citations.filter(c => c.id !== id);
            setCitations(updated);
            if (bookData?.id) saveCitationsForBook(bookData.id, updated);
          }}
          settings={settings}
          bookData={bookData}
        />
    <ShortcutHelpModal
      isOpen={showHelp}
      onClose={() => setShowHelp(false)}
      onZoomIn={() => setZoomPercent(z => Math.min(400, Math.round(z * 1.15)))}
      onZoomOut={() => setZoomPercent(z => Math.max(20, Math.round(z / 1.15)))}
      onToggleFit={() => setFitMode(m => m === 'page' ? 'width' : 'page')}
      activeReader={'pdf'}
    />
    <BookmarkModal isOpen={showBookmarkModal} onClose={() => setShowBookmarkModal(false)} onSave={handleSaveBookmark} />
    <CitationModal isOpen={showCitationModal} onClose={() => setShowCitationModal(false)} onSave={handleSaveCitation} />
    {/* ConfirmModal is provided globally by ConfirmProvider */}
    </div>
  );
};
// Load bookmarks and citations for this book when it becomes available
// (keeps PDF behavior consistent with EPUB reader)
// NOTE: placed inside the component body

export default PdfReaderView;
