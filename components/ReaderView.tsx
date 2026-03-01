/// <reference path="../global.d.ts" />

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { bookmarkService, citationService, positionTracker } from '../domain/reader';
import { db } from '../services/db';
import {
  buildTocFromSpine,
  findFirstChapter,
  getEpubViewStateForBook,
  getReaderSettings,
  performBookSearch,
  saveEpubViewStateForBook,
  saveReaderSettings,
} from '../services/readerUtils';
import { isDebug, trackEvent } from '../services/utils';
import type { Bookmark, BookRecord, Citation, CoverAnimationData, ReaderSettings, SearchResult, TocItem } from '../types';

import BookmarkModal from './BookmarkModal';
import CitationModal from './CitationModal';
import { AcademicCapIcon, BookmarkIcon, CloseIcon, LeftArrowIcon, ListIcon, PauseIcon, PlayIcon, RightArrowIcon, SearchIcon, SettingsIcon } from './icons';
import SearchPanel from './SearchPanel';
import SettingsPanel from './SettingsPanel';
import ShortcutHelpModal from './ShortcutHelpModal';
import Spinner from './Spinner';
import TocPanel from './TocPanel';
import ZoomHud from './ZoomHud';

// Use global types from window interface
type Book = ReturnType<Window['ePub']>;
type Rendition = ReturnType<Book['renderTo']>;
type Navigation = Awaited<ReturnType<Book['loaded']['navigation']['then']>>;


interface ReaderViewProps {
  bookId: number;
  onClose: () => void;
  animationData: CoverAnimationData | null;
}

const ReaderView: React.FC<ReaderViewProps> = ({ bookId, onClose, animationData }) => {
  const [bookData, setBookData] = useState<BookRecord | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showNavPanel, setShowNavPanel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCitationModal, setShowCitationModal] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationInfo, setLocationInfo] = useState({ currentPage: 0, totalPages: 0, progress: 0 });
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentCfi, setCurrentCfi] = useState<string | null>(null);
  const [currentChapterLabel, setCurrentChapterLabel] = useState<string>('');
  const [currentHighlightCfi, setCurrentHighlightCfi] = useState<string | null>(null);
  const [animationState, setAnimationState] = useState<'start' | 'expanding' | 'fading' | 'finished'>(
    animationData ? 'start' : 'finished',
  );
  const [isNavReady, setIsNavReady] = useState(false);
  const [usedTocFallback, setUsedTocFallback] = useState(false);

  useEffect(() => {
    if (!usedTocFallback) return;
    const t = window.setTimeout(() => setUsedTocFallback(false), 8000);
    return () => clearTimeout(t);
  }, [usedTocFallback]);
  const [speechState, setSpeechState] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const [showHelp, setShowHelp] = useState(false);
  const [showZoomHud, setShowZoomHud] = useState(false);
  const zoomHudTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!showZoomHud) return;
    if (zoomHudTimerRef.current) clearTimeout(zoomHudTimerRef.current);
    zoomHudTimerRef.current = window.setTimeout(() => setShowZoomHud(false), 1200);
    return () => {
      if (zoomHudTimerRef.current) {
        clearTimeout(zoomHudTimerRef.current);
        zoomHudTimerRef.current = null;
      }
    };
  }, [showZoomHud]);

  const [settings, setSettings] = useState<ReaderSettings>(getReaderSettings);

  const viewerRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLImageElement | null>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const speechStateRef = useRef(speechState);
  speechStateRef.current = speechState;
  const navigationRef = useRef<Navigation | null>(null);
  const sliderTimeoutRef = useRef<number | null>(null);
  const latestCfiRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const renditionResizeTimerRef = useRef<number | null>(null);
  const locationsReadyRef = useRef(false);
  const highlightedCfiRef = useRef<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastSpokenCfiRef = useRef<string | null>(null);
  const speechStartCfiRef = useRef<string | null>(null);
  const currentSentenceRef = useRef<string>('');
  const speechContextRef = useRef<{ rawText: string, normalizedText: string, startIndexInNormalized: number } | null>(null);
  const isAutoPagingRef = useRef(false);


  const isAnyPanelOpen = useMemo(
    () => showSettings || showNavPanel || showSearch,
    [showSettings, showNavPanel, showSearch],
  );

  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  }, []);

  const resetControlsTimeout = useCallback(() => {
    clearControlsTimeout();
    if (!isAnyPanelOpen) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isAnyPanelOpen, clearControlsTimeout]);

  // Animation effect to start the cover expansion
  useEffect(() => {
    if (animationState !== 'start') return;
    const timer = setTimeout(() => setAnimationState('expanding'), 50); // Short delay to ensure transition applies
    return () => clearTimeout(timer);
  }, [animationState]);

  // Imperatively update cover image position/size when animation state or animationData changes
  useEffect(() => {
    const img = coverRef.current;
    if (!img || !animationData) return;

    if (animationState === 'start') {
      // set initial position/size to match library thumbnail
      img.style.position = 'absolute';
      img.style.top = `${animationData.rect.top}px`;
      img.style.left = `${animationData.rect.left}px`;
      img.style.width = `${animationData.rect.width}px`;
      img.style.height = `${animationData.rect.height}px`;
      img.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    } else if (animationState === 'expanding') {
      // expand to center
      img.style.position = 'absolute';
      img.style.top = '50%';
      img.style.left = '50%';
      img.style.transform = 'translate(-50%, -50%)';
      img.style.width = 'auto';
      img.style.height = '80vh';
      img.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    } else if (animationState === 'fading') {
      // fade out handled by parent opacity class; keep last transform
    }
  }, [animationState, animationData]);

  // Fetch book data once, on mount or when bookId changes
  useEffect(() => {
    const fetchBook = async () => {
      const data = await db.getBook(bookId);
      if (data) {
        setBookData(data);
      } else {
        console.error('Book not found');
        onClose();
      }
    };
    fetchBook();
  }, [bookId, onClose]);

  // Smart default voice selection effect
  useEffect(() => {
    const setDefaultVoice = () => {
      const currentSettings = getReaderSettings();
      if (currentSettings.readAloud.voiceURI) {
        return;
      }

      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length === 0) {
        return;
      }

      const bestVoice = availableVoices.find(v => v.default) ||
        availableVoices.find(v => v.lang === 'en-US' && /google/i.test(v.name)) ||
        availableVoices.find(v => v.lang === 'en-US' && /microsoft/i.test(v.name)) ||
        availableVoices.find(v => v.lang === 'en-US' && v.localService) ||
        availableVoices.find(v => v.lang === 'en-US') ||
        null;

      if (bestVoice) {
        setSettings(prevSettings => {
          const newReadAloudSettings = { ...prevSettings.readAloud, voiceURI: bestVoice!.voiceURI };
          const newSettings = { ...prevSettings, readAloud: newReadAloudSettings };
          saveReaderSettings(newSettings);
          return newSettings;
        });
      }
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      setDefaultVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = setDefaultVoice;
    }

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const saveLastSpokenPosition = useCallback(() => {
    if (lastSpokenCfiRef.current) {
      // Save TTS position using positionTracker
      positionTracker.saveSpeechPosition(bookId, lastSpokenCfiRef.current);
    }
  }, [bookId]);

  const removeHighlight = useCallback(() => {
    if (highlightedCfiRef.current && renditionRef.current) {
      renditionRef.current.annotations.remove(highlightedCfiRef.current, 'highlight');
      highlightedCfiRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    if (speechStateRef.current !== 'stopped') {
      saveLastSpokenPosition();
    }
    setSpeechState('stopped');
    window.speechSynthesis.cancel();
    isAutoPagingRef.current = false;
    removeHighlight();
    utteranceRef.current = null;
    lastSpokenCfiRef.current = null;
    currentSentenceRef.current = '';
  }, [removeHighlight, saveLastSpokenPosition]);

  const startSpeech = useCallback(() => {
    const currentRendition = renditionRef.current;
    if (!currentRendition) return;

    if (speechStateRef.current !== 'stopped') {
      window.speechSynthesis.cancel();
      removeHighlight();
    }

    const contents = currentRendition.getContents();
    if (!contents || contents.length === 0) return;

    const body = contents[0].document?.body;
    if (!body) return;

    const rawText = body.textContent || '';
    const normalizedText = rawText.replace(/\s+/g, ' ').trim();
    if (!normalizedText) {
      if (settingsRef.current.flow === 'paginated' && speechStateRef.current === 'playing') {
        isAutoPagingRef.current = true;
        currentRendition.next();
      }
      return;
    }

    let textToRead = normalizedText;
    let startIndexInNormalized = 0;
    const startCfi = speechStartCfiRef.current;

    if (startCfi) {
      try {
        const range = contents[0].range(startCfi);
        if (range) {
          const textForCfi = range.toString().replace(/\s+/g, ' ').trim();
          const searchIndex = normalizedText.indexOf(textForCfi);
          if (searchIndex !== -1) {
            startIndexInNormalized = searchIndex;
            textToRead = normalizedText.substring(startIndexInNormalized);
          }
        }
      } catch (e) {
        console.error('Could not find start CFI for speech, starting from beginning.', e);
      } finally {
        speechStartCfiRef.current = null;
      }
    }

    speechContextRef.current = { rawText, normalizedText, startIndexInNormalized };
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utteranceRef.current = utterance;

    const voices = window.speechSynthesis.getVoices();
    const currentSettings = settingsRef.current;
    const selectedVoice = voices.find(v => v.voiceURI === currentSettings.readAloud.voiceURI);

    utterance.voice = selectedVoice || null;
    utterance.rate = currentSettings.readAloud.rate;
    utterance.pitch = currentSettings.readAloud.pitch;
    utterance.volume = currentSettings.readAloud.volume;

    utterance.onboundary = (event) => {
      if (event.name !== 'word' || !renditionRef.current || !body || !speechContextRef.current) return;

      const { rawText, normalizedText, startIndexInNormalized } = speechContextRef.current;
      const absoluteCharIndex = event.charIndex + startIndexInNormalized;
      // Disabled: findSentenceRange and findDomRangeFromCharacterOffsets are not available
      // const sentenceInfo = findSentenceRange(normalizedText, absoluteCharIndex);

      // if (!sentenceInfo || sentenceInfo.sentence === currentSentenceRef.current) {
      //   return;
      // }
      // currentSentenceRef.current = sentenceInfo.sentence;

      // try {
      //   const estimatedRawIndex = (absoluteCharIndex / normalizedText.length) * rawText.length;

      //   let bestMatchIndex = -1;
      //   let minDistance = Infinity;
      //   let currentIndex = -1;

      //   while ((currentIndex = rawText.indexOf(sentenceInfo.sentence, currentIndex + 1)) !== -1) {
      //     const distance = Math.abs(currentIndex - estimatedRawIndex);
      //     if (distance < minDistance) {
      //       minDistance = distance;
      //       bestMatchIndex = currentIndex;
      //     }
      //   }

      //   if (bestMatchIndex !== -1) {
      //     const rawStartOffset = bestMatchIndex;
      //     const rawEndOffset = bestMatchIndex + sentenceInfo.sentence.length;
      //     const domRange = findDomRangeFromCharacterOffsets(body, rawStartOffset, rawEndOffset);

      //     if (domRange) {
      //       const contents = renditionRef.current.getContents()[0];
      //       const cfi = contents.cfiFromRange(domRange);
      //       if (cfi) {
      // Disabled: sentence highlighting logic (cfi, domRange, etc.) due to missing dependencies after rollback
      // lastSpokenCfiRef.current = cfi;
      // removeHighlight();
      // renditionRef.current.annotations.add('highlight', cfi, {}, undefined, 'tts-highlight', {
      //   'fill': 'rgba(0, 191, 255, 0.4)',
      // });
      // highlightedCfiRef.current = cfi;
      // if (settingsRef.current.flow === 'scrolled') {
      //   const iframe = viewerRef.current?.querySelector('iframe');
      //   const elementToScroll = domRange.startContainer.parentElement;
      //   if (elementToScroll && iframe) {
      //     const elementRect = elementToScroll.getBoundingClientRect();
      //     const iframeRect = iframe.getBoundingClientRect();
      //     const elementTopInIframe = elementRect.top - iframeRect.top;
      //     const elementBottomInIframe = elementRect.bottom - iframeRect.top;
      //     const iframeVisibleHeight = iframeRect.height;
      //     const safeZoneTop = iframeVisibleHeight * 0.3;
      //     const safeZoneBottom = iframeVisibleHeight * 0.7;
      //     if (elementTopInIframe < safeZoneTop || elementBottomInIframe > safeZoneBottom) {
      //       elementToScroll.scrollIntoView({
      //         behavior: 'smooth',
      //         block: 'center',
      //         inline: 'nearest',
      //       });
      //     }
      //   }
      // }
      // }
      // }
      // }
      // } catch (e) {
      //   console.error('Error during sentence highlighting:', e);
      // }
    };

    utterance.onend = () => {
      removeHighlight();

      // If the speech state is not 'playing' when onend fires, it means
      // the event was triggered by a manual pause() or cancel() call.
      // In this case, we should not proceed to the next page.
      if (speechStateRef.current !== 'playing') {
        if (speechStateRef.current === 'paused') {
          return; // Stay in paused state
        }
        setSpeechState('stopped'); // Finalize to stopped state
        return;
      }

      // If we get here, speech ended naturally while in the 'playing' state.
      if (settingsRef.current.flow === 'paginated') {
        isAutoPagingRef.current = true;
        renditionRef.current?.next();
      } else {
        setSpeechState('stopped');
      }
    };

    utterance.onerror = (e) => {
      console.error('SpeechSynthesisUtterance error', e);
      stopSpeech();
    };

    window.speechSynthesis.speak(utterance);
    setSpeechState('playing');
  }, [stopSpeech, removeHighlight]);

  // Initialize epub.js rendition only after animation is finished
  useEffect(() => {
    if (animationState !== 'finished' || !bookData || !viewerRef.current) {
      return;
    }

    let isMounted = true;

    const initializeBook = async () => {
      try {
        setIsLoading(true);

        const ePub = window.ePub;
        const bookInstance = ePub(bookData.epubData);
        bookRef.current = bookInstance;

        if (viewerRef.current) {
          viewerRef.current.innerHTML = '';
          viewerRef.current.style.opacity = '0';
        }

        const renditionInstance = bookInstance.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: settings.flow === 'scrolled' ? 'scrolled-doc' : 'paginated',
          manager: 'default',
          spread: 'auto',
        });
        if (!isMounted) return;
        setRendition(renditionInstance);
        renditionRef.current = renditionInstance;

        const nav = await bookInstance.loaded.navigation;
        if (!isMounted) return;
        // nav.toc may be undefined for older EPUB2/NCX; build fallback from spine if needed
        try {
          if (nav && nav.toc && Array.isArray(nav.toc) && nav.toc.length > 0) {
            if (isDebug()) console.debug('ReaderView: using navigation.toc with', nav.toc.length, 'entries');
            setToc(nav.toc);
            setUsedTocFallback(false);
          } else {
            if (isDebug()) console.debug('ReaderView: navigation.toc missing or empty, building fallback TOC from spine');
            const fallback = buildTocFromSpine(bookInstance);
            // normalize fallback items to match TocItem shape
            const normalized = fallback.map((f: any) => ({ id: f.id, href: f.href, label: f.label, subitems: [] }));
            setToc(normalized as any);
            setUsedTocFallback(true);
            // track analytics event for fallback usage
            try { trackEvent('toc_fallback', { bookId: bookId, fallbackCount: (fallback && fallback.length) || 0 }); } catch (e) { /* ignore */ }
          }
        } catch (e) {
          if (isDebug()) console.warn('Error processing navigation TOC, using fallback', e);
          const fallback = buildTocFromSpine(bookInstance);
          const normalized = fallback.map((f: any) => ({ id: f.id, href: f.href, label: f.label, subitems: [] }));
          setToc(normalized as any);
          setUsedTocFallback(true);
          try { trackEvent('toc_fallback', { bookId: bookId, fallbackCount: (fallback && fallback.length) || 0, error: String(e) }); } catch (er) { /* ignore */ }
        }
        navigationRef.current = nav || null;
        setIsNavReady(true);

        renditionInstance.on('relocated', (location: any) => {
          if (!isMounted) return;

          const cfi = location.start.cfi;
          setCurrentCfi(cfi);

          if (cfi) {
            latestCfiRef.current = cfi;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = window.setTimeout(() => {
              // Save reading position using positionTracker
              positionTracker.savePosition(bookId, cfi);
            }, 1000);
          }

          if (locationsReadyRef.current && bookRef.current?.locations) {
            const bookLocations = bookRef.current.locations;
            const page = bookLocations.locationFromCfi(location.start.cfi);

            if (page > -1) {
              const progress = bookLocations.percentageFromCfi(location.start.cfi);
              setLocationInfo({
                currentPage: page + 1,
                totalPages: bookLocations.length(),
                progress: Math.round((progress || 0) * 100),
              });
            }
          }

          if (isAutoPagingRef.current) {
            isAutoPagingRef.current = false;
            startSpeech();
          }
        });

        await bookInstance.ready;
        if (!isMounted) return;

        locationsReadyRef.current = false;
        await bookInstance.locations.generate(1600);
        if (!isMounted) return;
        locationsReadyRef.current = true;

        if (bookInstance.locations) {
          setLocationInfo(prev => ({ ...prev, totalPages: bookInstance.locations.length(), currentPage: 1 }));
        }

        // Load bookmarks using bookmarkService
        const bookmarksResult = bookmarkService.findByBookId(bookId);
        if (bookmarksResult.success) {
          setBookmarks(bookmarksResult.data);
        }

        // Load citations using citationService
        const citationsResult = citationService.findByBookId(bookId);
        if (citationsResult.success) {
          setCitations(citationsResult.data);
        }

        // Load last spoken position (TTS) using positionTracker
        const speechPosResult = positionTracker.getSpeechPosition(bookId);
        speechStartCfiRef.current = speechPosResult.success ? speechPosResult.data : null;

        // Load last reading position using positionTracker
        const posResult = positionTracker.getPosition(bookId);
        const startLocation = (posResult.success ? posResult.data : null) || await findFirstChapter(bookInstance);

        if (!isMounted) return;

        // Try to display the preferred startLocation, but be defensive: if the section
        // is missing (common in older/corrupted EPUBs), fall back to the first spine item
        // or a bare rendition.display() call.
        if (renditionInstance) {
          try {
            await renditionInstance.display(startLocation || undefined);
          } catch (err: any) {
            console.warn(`rendition.display failed for ${startLocation}. Attempting spine fallback.`, err);
            // Try first spine href when possible
            try {
              const firstSpineHref = bookInstance?.spine?.items && bookInstance.spine.items.length > 0 ? bookInstance.spine.items[0].href : undefined;
              if (firstSpineHref) {
                await renditionInstance.display(firstSpineHref);
              } else {
                await renditionInstance.display();
              }
            } catch (err2) {
              console.error('Failed to display book using spine fallback or default', err2);
            }
          }
        }

        if (!isMounted) return;
        setIsLoading(false);

        if (viewerRef.current) {
          viewerRef.current.style.transition = 'opacity 0.3s ease-in';
          viewerRef.current.style.opacity = '1';
        }
        // Restore per-book epub view state (e.g., font size) if available
        try {
          if (bookId) {
            const ev = getEpubViewStateForBook(bookId);
            if (ev && ev.fontSize && typeof ev.fontSize === 'number') {
              setSettings(prev => ({ ...prev, fontSize: ev.fontSize }));
            }
          }
        } catch (e) { /* ignore */ }
      } catch (error) {
        if (isMounted) {
          console.error('Error initializing EPUB:', error);
        }
      }
    };

    initializeBook();

    return () => {
      isMounted = false;
      stopSpeech();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (latestCfiRef.current) {
        positionTracker.savePosition(bookId, latestCfiRef.current);
      }
      locationsReadyRef.current = false;
      setIsNavReady(false);
      navigationRef.current = null;
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
      renditionRef.current = null;
      setRendition(null);
    };
  }, [bookId, bookData, settings.flow, animationState, startSpeech, stopSpeech]);

  useEffect(() => {
    if (rendition) {
      if (!(rendition as any).themesRegistered) {
        const lightTheme = { body: { 'color': '#000', 'background': '#fff' } };
        const darkTheme = { body: { 'color': '#fff', 'background': '#1f2937' } };
        rendition.themes.register('light', lightTheme);
        rendition.themes.register('dark', darkTheme);
        (rendition as any).themesRegistered = true;
      }

      rendition.themes.select(settings.theme);
      rendition.themes.fontSize(`${settings.fontSize}%`);
      if (settings.fontFamily === 'Original') {
        rendition.themes.font('inherit');
      } else if (settings.fontFamily === 'Serif') {
        rendition.themes.font('Georgia, "Times New Roman", serif');
      } else if (settings.fontFamily === 'Sans-Serif') {
        rendition.themes.font('"Helvetica Neue", Helvetica, Arial, sans-serif');
      }
    }
    saveReaderSettings(settings);
  }, [rendition, settings]);

  // Persist per-book epub view state when font size changes
  useEffect(() => {
    if (!bookId) return;
    try {
      saveEpubViewStateForBook(bookId, { fontSize: settings.fontSize });
    } catch (e) {
      console.warn('Failed to save epub view state', e);
    }
  }, [settings.fontSize, bookId]);

  // EPUB-specific zoom handlers (adjust font size percentage)
  const epubZoomIn = () => {
    setSettings(s => {
      const next = Math.min(300, Math.round(s.fontSize * 1.15));
      return { ...s, fontSize: next };
    });
    setShowZoomHud(true);
  };
  const epubZoomOut = () => {
    setSettings(s => {
      const next = Math.max(50, Math.round(s.fontSize / 1.15));
      return { ...s, fontSize: next };
    });
    setShowZoomHud(true);
  };
  const epubToggleFit = () => {
    // For EPUB, toggle between 'paginated' and 'scrolled' flow as a form of fit toggle
    setSettings(s => ({ ...s, flow: s.flow === 'paginated' ? 'scrolled' : 'paginated' }));
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (rendition) {
      // Clear any previous scheduled resize
      if (renditionResizeTimerRef.current) {
        clearTimeout(renditionResizeTimerRef.current);
        renditionResizeTimerRef.current = null;
      }
      // Schedule a safe resize — check renditionRef.current at call time
      renditionResizeTimerRef.current = window.setTimeout(() => {
        try {
          if (renditionRef.current && typeof renditionRef.current.resize === 'function') {
            renditionRef.current.resize();
          }
        } catch (e) {
          // Rendition may have been destroyed; swallow to avoid uncaught exceptions
          console.warn('Safe resize failed, rendition may no longer be available.', e);
        }
      }, 50);

      return () => {
        if (renditionResizeTimerRef.current) {
          clearTimeout(renditionResizeTimerRef.current);
          renditionResizeTimerRef.current = null;
        }
      };
    }
  }, [controlsVisible, rendition]);

  useEffect(() => {
    if (controlsVisible && !isAnyPanelOpen) {
      resetControlsTimeout();
    } else {
      clearControlsTimeout();
    }
    if (isAnyPanelOpen && !controlsVisible) setControlsVisible(true);
    return clearControlsTimeout;
  }, [controlsVisible, isAnyPanelOpen, resetControlsTimeout, clearControlsTimeout]);

  // Effect to get the current chapter label once navigation is ready and location changes
  useEffect(() => {
    if (currentCfi && isNavReady && navigationRef.current) {
      const nav = navigationRef.current as any;
      const tocItemPromise = nav.get(currentCfi);
      if (tocItemPromise && typeof tocItemPromise.then === 'function') {
        tocItemPromise.then((tocItem: any) => {
          if (tocItem && tocItem.label) {
            setCurrentChapterLabel(tocItem.label.trim());
          }
        });
      }
    }
  }, [currentCfi, isNavReady]);

  const nextPage = useCallback(() => { rendition?.next(); setControlsVisible(true); stopSpeech(); }, [rendition, stopSpeech]);
  const prevPage = useCallback(() => { rendition?.prev(); setControlsVisible(true); stopSpeech(); }, [rendition, stopSpeech]);

  // Keyboard shortcuts for EPUB reader
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement && (document.activeElement as HTMLElement).tagName;
      if (active === 'INPUT' || active === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        prevPage();
      } else if (e.key === 'ArrowRight') {
        nextPage();
      } else if (e.key === ' ') {
        e.preventDefault();
        nextPage();
      } else if (e.key.toLowerCase() === 'c') {
        setShowNavPanel(s => !s);
      } else if (e.key === '?') {
        setShowHelp(s => !s);
      } else if (e.key === '+' || (e.key === '=' && e.shiftKey)) {
        epubZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        epubZoomOut();
      } else if (e.key.toLowerCase() === 'f') {
        epubToggleFit();
      } else if (e.key.toLowerCase() === 'b') {
        // Quick bookmark the current location
        if (!latestCfiRef.current) return;
        const newBookmark = {
          id: new Date().toISOString(),
          cfi: latestCfiRef.current,
          label: `Page ${locationInfo.currentPage}`,
          chapter: currentChapterLabel,
          description: undefined,
          createdAt: Date.now(),
        };

        // Add bookmark using bookmarkService
        const addResult = bookmarkService.add(bookId, {
          cfi: latestCfiRef.current!,
          label: `Page ${locationInfo.currentPage}`,
          chapter: currentChapterLabel,
        });

        if (addResult.success) {
          const updated = [...bookmarks, addResult.data];
          setBookmarks(updated);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevPage, nextPage, bookmarks, bookId, locationInfo.currentPage, currentChapterLabel]);

  useEffect(() => {
    if (!rendition) return;

    const clickHandler = (event: PointerEvent) => {
      if (showSettings || showNavPanel || showSearch || !viewerRef.current) return;
      const rect = viewerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const width = rect.width;
      const clickZone = width * 0.3;

      if (settings.flow === 'paginated') {
        if (x < clickZone) prevPage();
        else if (x > width - clickZone) nextPage();
        else setControlsVisible(v => !v);
      } else {
        setControlsVisible(v => !v);
      }
    };
    rendition.on('click', clickHandler);
    return () => { rendition.off('click', clickHandler); };
  }, [rendition, settings.flow, showSettings, showNavPanel, showSearch, prevPage, nextPage]);

  const handleSettingsChange = (newSettings: Partial<ReaderSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.readAloud) {
        updated.readAloud = { ...prev.readAloud, ...newSettings.readAloud };
      }
      return updated;
    });
  };
  const safeDisplay = useCallback(async (loc?: string) => {
    if (!renditionRef.current) {
      if (isDebug()) console.warn('safeDisplay: rendition not ready');
      return;
    }
    try {
      await renditionRef.current.display(loc || undefined);
    } catch (err) {
      if (isDebug()) console.warn('safeDisplay: rendition.display failed for', loc, err);
      // Try resolving common older/NCX idref cases and href variants before falling back
      try {
        const book = bookRef.current;
        const tried = new Set<string>();

        const tryDisplay = async (candidate?: string) => {
          if (!candidate || tried.has(candidate)) return false;
          tried.add(candidate);
          try {
            if (isDebug()) console.debug('safeDisplay: trying candidate', candidate);
            await renditionRef.current.display(candidate);
            return true;
          } catch (e) {
            if (isDebug()) console.debug('safeDisplay: candidate failed', candidate, e);
            return false;
          }
        };

        // If no loc provided, try first spine item or default display
        if (!loc) {
          const firstSpineHref = book?.spine?.items && book.spine.items.length > 0 ? book.spine.items[0].href : undefined;
          if (firstSpineHref && await tryDisplay(firstSpineHref)) return;
          await tryDisplay(undefined);
          return;
        }

        const orig = loc;
        // Try the original loc
        if (await tryDisplay(orig)) return;

        // Strip fragment and retry (chapter.html#id -> chapter.html)
        const noFrag = orig.split('#')[0];
        if (noFrag !== orig && await tryDisplay(noFrag)) return;

        // If loc looks like an idref (no slash, no dot), attempt to find matching spine item by id/idref
        const looksLikeIdref = !/[/.]/.test(orig);
        if (looksLikeIdref && book?.spine?.items) {
          for (const item of book.spine.items) {
            if (item.id === orig || item.idref === orig || (item.href && item.href.split('#')[0].endsWith(orig))) {
              const candidateHref = item.href;
              if (candidateHref && await tryDisplay(candidateHref)) return;
            }
          }
        }

        // Try matching spine hrefs that end with the noFrag path portion
        if (book?.spine?.items) {
          const tail = noFrag.split('/').pop();
          if (tail) {
            for (const item of book.spine.items) {
              if (item.href && item.href.split('#')[0].endsWith(tail)) {
                if (await tryDisplay(item.href)) return;
              }
            }
          }
        }

        // Try first spine item as a last content fallback
        const firstSpineHref = book?.spine?.items && book.spine.items.length > 0 ? book.spine.items[0].href : undefined;
        if (firstSpineHref && await tryDisplay(firstSpineHref)) return;

        // Finally try display without args
        await tryDisplay(undefined);
      } catch (err2) {
        console.error('safeDisplay: rendition.display fallback failed', err2);
      }
    }
  }, []);

  const handleTocNavigate = (href: string) => { stopSpeech(); void safeDisplay(href); setShowNavPanel(false); };
  const handleBookmarkNavigate = (cfi: string) => { stopSpeech(); void safeDisplay(cfi); setShowNavPanel(false); };
  const handleCitationNavigate = (cfi: string) => { stopSpeech(); void safeDisplay(cfi); setShowNavPanel(false); };

  const handleSaveBookmark = useCallback(async (description: string) => {
    if (!latestCfiRef.current) return;

    const cfi = latestCfiRef.current;
    let chapter = currentChapterLabel;

    if (navigationRef.current) {
      try {
        const tocItemPromise = (navigationRef.current as any).get(cfi);
        if (tocItemPromise && typeof tocItemPromise.then === 'function') {
          const tocItem = await tocItemPromise;
          if (tocItem?.label) {
            chapter = tocItem.label.trim();
          }
        }
      } catch (e) {
        console.warn('Could not fetch chapter for bookmark, using last known chapter.', e);
      }
    }

    const newBookmark: Bookmark = {
      id: new Date().toISOString(),
      cfi: cfi,
      label: `Page ${locationInfo.currentPage} (${locationInfo.progress}%)`,
      chapter: chapter,
      description: description || undefined,
      createdAt: Date.now(),
    };

    // Add bookmark with custom note using bookmarkService
    const addResult = bookmarkService.add(bookId, {
      cfi: latestCfiRef.current!,
      label: `Page ${locationInfo.currentPage} (${locationInfo.progress}%)`,
      chapter: chapter,
      description: description || undefined,
    });

    if (addResult.success) {
      const updatedBookmarks = [...bookmarks, addResult.data];
      setBookmarks(updatedBookmarks);
    }

    setShowBookmarkModal(false);
  }, [bookId, bookmarks, locationInfo.currentPage, locationInfo.progress, currentChapterLabel]);


  const deleteBookmark = useCallback((bookmarkId: string) => {
    // Delete bookmark using bookmarkService
    const deleteResult = bookmarkService.delete(bookId, bookmarkId);

    if (deleteResult.success) {
      const updatedBookmarks = bookmarks.filter(b => b.id !== bookmarkId);
      setBookmarks(updatedBookmarks);
    }
  }, [bookId, bookmarks]);

  const handleSaveCitation = useCallback(async (note: string) => {
    if (!latestCfiRef.current) return;

    const cfi = latestCfiRef.current;
    let chapter = currentChapterLabel;

    if (navigationRef.current) {
      try {
        const tocItemPromise = (navigationRef.current as any).get(cfi);
        if (tocItemPromise && typeof tocItemPromise.then === 'function') {
          const tocItem = await tocItemPromise;
          if (tocItem?.label) {
            chapter = tocItem.label.trim();
          }
        }
      } catch (e) {
        console.warn('Could not fetch chapter for citation, using last known chapter.', e);
      }
    }

    // Add citation using citationService
    const addResult = citationService.add(bookId, {
      cfi: cfi,
      note: note,
      pageNumber: locationInfo.currentPage > 0 ? locationInfo.currentPage : undefined,
      chapter: chapter,
      citationFormat: 'apa',
    });

    if (addResult.success) {
      const updatedCitations = [...citations, addResult.data];
      setCitations(updatedCitations);
    }

    setShowCitationModal(false);
  }, [bookId, citations, locationInfo.currentPage, currentChapterLabel]);

  const deleteCitation = useCallback((citationId: string) => {
    // Delete citation using citationService
    const deleteResult = citationService.delete(bookId, citationId);

    if (deleteResult.success) {
      const updatedCitations = citations.filter(c => c.id !== citationId);
      setCitations(updatedCitations);
    }
  }, [bookId, citations]);

  const isCurrentPageBookmarked = useMemo(() => bookmarks.some(b => b.cfi === currentCfi), [bookmarks, currentCfi]);

  const toggleBookmark = useCallback(() => {
    if (isCurrentPageBookmarked) {
      const bookmarkToRemove = bookmarks.find(b => b.cfi === currentCfi);
      if (bookmarkToRemove) deleteBookmark(bookmarkToRemove.id);
    } else {
      setShowBookmarkModal(true);
    }
  }, [isCurrentPageBookmarked, deleteBookmark, bookmarks, currentCfi]);

  const performSearch = useCallback(async (query: string) => {
    if (!query || !bookRef.current) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    if (currentHighlightCfi && rendition) {
      rendition.annotations.remove(currentHighlightCfi, 'highlight');
      setCurrentHighlightCfi(null);
    }
    try {
      setIsSearching(true);
      const results = await performBookSearch(bookRef.current, query);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [rendition, currentHighlightCfi]);

  const handleQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      performSearch(query);
    }, 500);
  }, [performSearch]);

  const handleNavigateToResult = useCallback((cfi: string) => {
    if (!rendition) return;

    if (currentHighlightCfi) {
      rendition.annotations.remove(currentHighlightCfi, 'highlight');
    }

    stopSpeech();
    setShowSearch(false);
    void safeDisplay(cfi).then(() => {
      try {
        rendition.annotations.add('highlight', cfi, {}, undefined, 'hl', { 'fill': 'yellow', 'fill-opacity': '0.3' });
        setCurrentHighlightCfi(cfi);
      } catch (e) {
        console.warn('Failed to add highlight after navigation', e);
      }
    });
  }, [rendition, currentHighlightCfi, stopSpeech]);

  const handleCloseSearch = () => {
    setShowSearch(false);
    if (currentHighlightCfi && rendition) {
      rendition.annotations.remove(currentHighlightCfi, 'highlight');
      setCurrentHighlightCfi(null);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (rendition && bookRef.current?.locations && locationsReadyRef.current) {
      setControlsVisible(true);
      stopSpeech();
      const newProgress = parseInt(e.target.value, 10);
      setLocationInfo(prev => ({ ...prev, progress: newProgress }));
      if (sliderTimeoutRef.current) clearTimeout(sliderTimeoutRef.current);
      sliderTimeoutRef.current = window.setTimeout(() => {
        const cfi = bookRef.current.locations.cfiFromPercentage(newProgress / 100);
        void safeDisplay(cfi);
      }, 150);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (settings.flow !== 'paginated') return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (settings.flow !== 'paginated' || touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (deltaX > 50) prevPage();
    else if (deltaX < -50) nextPage();
    touchStartXRef.current = null;
  };

  const toggleSpeech = () => {
    if (speechStateRef.current === 'playing') {
      setSpeechState('paused');
      window.speechSynthesis.pause();
      saveLastSpokenPosition();
      isAutoPagingRef.current = false;
    } else if (speechStateRef.current === 'paused') {
      setSpeechState('playing');
      window.speechSynthesis.resume();
    } else {
      startSpeech();
    }
  };


  return (
    <>
      {animationData && animationState !== 'finished' && (
        <div
          className={`theme-shell fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${animationState === 'fading' ? 'opacity-0' : 'opacity-100'}`}
          onTransitionEnd={() => {
            if (animationState === 'fading') setAnimationState('finished');
          }}
        >
          {animationData.coverImage && (
            <img
              ref={coverRef}
              src={animationData.coverImage}
              alt="Expanding book cover"
              className="object-contain rounded-lg shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
              onTransitionEnd={() => {
                if (animationState === 'expanding') {
                  setTimeout(() => setAnimationState('fading'), 200);
                }
              }}
            />
          )}
        </div>
      )}
      <div className={`theme-shell theme-text-primary fixed inset-0 flex flex-col select-none transition-opacity duration-500 ${animationState === 'fading' || animationState === 'finished' ? 'opacity-100' : 'opacity-0'}`}>
        <header
          className={`theme-surface-elevated theme-border theme-text-primary z-20 flex shrink-0 flex-wrap items-center justify-between border-b p-2 shadow-md transition-transform duration-300 ease-in-out sm:flex-nowrap sm:justify-start sm:gap-4 ${controlsVisible ? 'translate-y-0' : '-translate-y-full'}`}
          onMouseEnter={clearControlsTimeout}
          onMouseLeave={resetControlsTimeout}
        >
          {/* Fallback TOC banner */}
          {usedTocFallback && (
            <div className="absolute left-1/2 transform -translate-x-1/2 top-full mt-2 z-40">
              <div className="flex items-center gap-4 rounded border border-amber-400/50 bg-amber-500/20 px-4 py-2 text-amber-100 shadow-md backdrop-blur-sm">
                <span className="text-sm">This book's navigation was incomplete; a fallback contents list was used.</span>
                <button onClick={() => {
                  const firstHref = bookRef.current?.spine?.items && bookRef.current.spine.items.length > 0 ? bookRef.current.spine.items[0].href : undefined;
                  if (firstHref) void safeDisplay(firstHref);
                  setUsedTocFallback(false);
                }} className="rounded bg-amber-100/10 px-3 py-1 text-sm font-semibold hover:bg-amber-100/20">Open first content</button>
                <button onClick={() => setUsedTocFallback(false)} className="px-2 py-1 text-sm underline">Dismiss</button>
              </div>
            </div>
          )}
          {/* Left controls */}
          <div className="flex items-center gap-2 sm:order-1">
            <button onClick={onClose} className="theme-hover-surface rounded-full p-2 transition-colors" aria-label="Close Reader">
              <CloseIcon className="w-6 h-6" />
            </button>
            <button onClick={() => setShowNavPanel(true)} className="theme-hover-surface relative rounded-full p-2 transition-colors" aria-label="Contents and Bookmarks">
              <ListIcon className="w-6 h-6" />
              {(bookmarks.length > 0 || citations.length > 0) && (
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-sky-400 ring-2 ring-slate-800" />
              )}
            </button>
          </div>

          {/* Right controls */}
          <div className="flex justify-end items-center gap-2 sm:order-3">
            <button onClick={toggleSpeech} className="theme-hover-surface rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label={speechState === 'playing' ? 'Pause Read Aloud' : 'Start Read Aloud'}>
              {speechState === 'playing' ? <PauseIcon className="w-6 h-6 text-sky-400" /> : <PlayIcon className="w-6 h-6" />}
            </button>
            <button onClick={() => setShowSearch(true)} className="theme-hover-surface rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Search in book">
              <SearchIcon className="w-6 h-6" />
            </button>
            <button onClick={() => setShowCitationModal(true)} className="theme-hover-surface rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Create citation for this page">
              <AcademicCapIcon className="w-6 h-6" />
            </button>
            <button onClick={toggleBookmark} className="theme-hover-surface rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label={isCurrentPageBookmarked ? 'Remove bookmark from this page' : 'Add bookmark to this page'}>
              <BookmarkIcon className="w-6 h-6" filled={isCurrentPageBookmarked} />
            </button>
            <button onClick={() => setShowHelp(true)} className="theme-hover-surface rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Keyboard help">?
            </button>
            <button onClick={() => setShowSettings(true)} className="theme-hover-surface rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Settings">
              <SettingsIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Title/Author - Placed last in DOM for flexbox ordering */}
          <div className="text-center truncate px-2 w-full pt-2 sm:order-2 sm:w-auto sm:flex-grow sm:min-w-0 sm:pt-0">
            <h2 className="text-lg font-bold">{bookData?.title || 'Loading...'}</h2>
            <p className="theme-text-secondary text-sm">{bookData?.author}</p>
          </div>
        </header>

        <div
          className="flex-grow relative min-h-0"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {isLoading && (
            <div className="theme-shell absolute inset-0 z-30 flex items-center justify-center">
              <Spinner text="Loading Book..." />
            </div>
          )}
          {/* Viewer receives epub.js rendered content; add subtle padding and max-width for readability */}
          <div ref={viewerRef} id="viewer" className="theme-surface h-full w-full p-4 md:p-8" />
        </div>

        <footer
          className={`theme-surface-elevated theme-border theme-text-primary z-20 flex shrink-0 items-center gap-4 border-t p-4 transition-transform duration-300 ease-in-out ${controlsVisible ? 'translate-y-0' : 'translate-y-full'}`}
          onMouseEnter={clearControlsTimeout}
          onMouseLeave={resetControlsTimeout}
        >
          {settings.flow === 'paginated' ? (
            <button onClick={prevPage} className="theme-hover-surface shrink-0 rounded-full p-2 transition-colors" aria-label="Previous Page">
              <LeftArrowIcon className="w-6 h-6" />
            </button>
          ) : <div className="w-10 h-10 flex-shrink-0" /> /* Placeholder to keep layout consistent */}

          <div className="flex-grow flex flex-col justify-center">
            <input
              type="range"
              min="0"
              max="100"
              value={locationInfo.progress || 0}
              onChange={handleSliderChange}
              className="theme-slider h-2 w-full cursor-pointer appearance-none rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Book progress"
              disabled={!locationsReadyRef.current || locationInfo.totalPages === 0}
            />
            <div className="theme-text-secondary mt-2 text-center text-sm" aria-live="polite">
              {locationInfo.totalPages > 0 && locationsReadyRef.current ? (
                <span>Page {locationInfo.currentPage} of {locationInfo.totalPages} &bull; {locationInfo.progress}%</span>
              ) : (
                <span className="theme-text-muted">Calculating progress...</span>
              )}
            </div>
          </div>

          {/* Page jump input for quick navigation */}
          <div className="flex w-28 flex-col items-center text-sm">
            <label className="theme-text-secondary text-xs">Go to</label>
            <input
              type="number"
              min={1}
              max={locationInfo.totalPages || 9999}
              value={locationInfo.currentPage || ''}
              onChange={(e) => {
                const v = parseInt(e.target.value || '1', 10);
                if (isNaN(v) || !bookRef.current?.locations) return;
                const cfi = bookRef.current.locations.cfiFromLocation(v - 1);
                if (cfi) void safeDisplay(cfi);
              }}
              className="theme-input w-full rounded-md px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-label="Jump to page"
            />
          </div>

          {settings.flow === 'paginated' ? (
            <button onClick={nextPage} className="theme-hover-surface shrink-0 rounded-full p-2 transition-colors" aria-label="Next Page">
              <RightArrowIcon className="w-6 h-6" />
            </button>
          ) : <div className="w-10 h-10 flex-shrink-0" /> /* Placeholder */}
        </footer>

        <TocPanel
          isOpen={showNavPanel}
          onClose={() => setShowNavPanel(false)}
          toc={toc}
          onTocNavigate={handleTocNavigate}
          bookmarks={bookmarks}
          onBookmarkNavigate={handleBookmarkNavigate}
          onDeleteBookmark={deleteBookmark}
          citations={citations}
          onCitationNavigate={handleCitationNavigate}
          onDeleteCitation={deleteCitation}
          settings={settings}
          bookData={bookData}
        />
        <SearchPanel
          isOpen={showSearch}
          onClose={handleCloseSearch}
          onQueryChange={handleQueryChange}
          onNavigate={handleNavigateToResult}
          results={searchResults}
          isLoading={isSearching}
          searchQuery={searchQuery}
        />
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />
        <CitationModal
          isOpen={showCitationModal}
          onClose={() => setShowCitationModal(false)}
          onSave={handleSaveCitation}
        />
        <BookmarkModal
          isOpen={showBookmarkModal}
          onClose={() => setShowBookmarkModal(false)}
          onSave={handleSaveBookmark}
        />
        <ShortcutHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} onZoomIn={epubZoomIn} onZoomOut={epubZoomOut} onToggleFit={epubToggleFit} activeReader={'epub'} />
        <ZoomHud value={`${settings.fontSize}%`} isOpen={showZoomHud} />
      </div>
    </>
  );
};

export default ReaderView;
