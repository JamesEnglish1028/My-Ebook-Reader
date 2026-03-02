import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { BookRecord, RequestAuthorization } from '../types';
import { db, getCachedPatronAuthorizationForUrl, proxiedUrl } from '../services';
import { parseAudiobookManifest } from '../services/audiobookManifest';
import { getLastPositionForBook, saveLastPositionForBook } from '../services/readerUtils';

import { CloseIcon } from './icons';
import Spinner from './Spinner';

interface AudioReaderViewProps {
  bookId?: number;
  onClose?: () => void;
}

interface SavedAudioPosition {
  trackIndex: number;
  time: number;
}

const buildAuthorizationHeader = (auth: RequestAuthorization): string => (
  auth.scheme === 'bearer'
    ? `Bearer ${auth.token}`
    : `Basic ${btoa(`${auth.username}:${auth.password}`)}`
);

const normalizeResourceHref = (href: string): string => href.split('#')[0];

const AudioReaderView: React.FC<AudioReaderViewProps> = ({ bookId: propBookId, onClose: propOnClose }) => {
  const bookId = propBookId ?? null;
  const onClose = propOnClose ?? (() => undefined);
  const [bookData, setBookData] = useState<BookRecord | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [resumeTime, setResumeTime] = useState(0);
  const [trackSrc, setTrackSrc] = useState<string | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [isContentsOpen, setIsContentsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const saveTickRef = useRef(0);

  useEffect(() => {
    const fetchBook = async () => {
      if (!bookId) {
        setManifestError('Missing audiobook id.');
        setIsLoading(false);
        return;
      }
      const data = await db.getBook(bookId);
      if (!data) {
        setManifestError('Could not find this audiobook in your library.');
        setIsLoading(false);
        return;
      }
      if ((data.format || '').toUpperCase() !== 'AUDIOBOOK') {
        setManifestError('The selected item is not an audiobook.');
        setIsLoading(false);
        return;
      }
      setBookData(data);
      const saved = getLastPositionForBook(bookId);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as SavedAudioPosition;
          if (Number.isFinite(parsed.trackIndex)) setCurrentTrackIndex(parsed.trackIndex);
          if (Number.isFinite(parsed.time)) setResumeTime(parsed.time);
        } catch {
          // ignore invalid saved state
        }
      }
      setIsLoading(false);
    };
    void fetchBook();
  }, [bookId]);

  const parsedManifest = useMemo(() => {
    if (!bookData) return { manifest: null, error: null as string | null };
    try {
      return {
        manifest: parseAudiobookManifest(bookData.epubData, bookData.sourceUrl || bookData.providerId),
        error: null,
      };
    } catch (error) {
      return {
        manifest: null,
        error: error instanceof Error ? error.message : 'Failed to parse audiobook manifest.',
      };
    }
  }, [bookData]);

  const manifest = parsedManifest.manifest;

  useEffect(() => {
    setManifestError(parsedManifest.error);
  }, [parsedManifest.error]);

  const currentTrack = manifest?.tracks[currentTrackIndex] || null;
  const coverImage = bookData?.coverImage || manifest?.coverImageUrl || null;
  const chapterGroups = useMemo(() => {
    if (!manifest || manifest.toc.length === 0) return [];

    const trackStarts = manifest.toc
      .map((item, tocIndex) => {
        const normalizedTocHref = normalizeResourceHref(item.href);
        const matchedTrackIndex = manifest.tracks.findIndex(
          (track) => normalizeResourceHref(track.href) === normalizedTocHref,
        );
        if (matchedTrackIndex < 0) return null;
        return {
          title: item.title,
          startIndex: matchedTrackIndex,
          tocIndex,
        };
      })
      .filter((item): item is { title: string; startIndex: number; tocIndex: number } => item !== null)
      .sort((a, b) => a.startIndex - b.startIndex);

    return trackStarts.map((group, index) => {
      const endExclusive = index < trackStarts.length - 1
        ? trackStarts[index + 1].startIndex
        : manifest.tracks.length;
      return {
        title: group.title,
        tocIndex: group.tocIndex,
        tracks: manifest.tracks
          .slice(group.startIndex, endExclusive)
          .map((track, trackOffset) => ({
            track,
            trackIndex: group.startIndex + trackOffset,
          })),
      };
    });
  }, [manifest]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!Number.isFinite(resumeTime) || resumeTime <= 0) return;
    const audio = audioRef.current;
    const applyResumeTime = () => {
      try {
        if (resumeTime <= (audio.duration || Number.POSITIVE_INFINITY)) {
          audio.currentTime = resumeTime;
        }
      } catch {
        // ignore
      }
    };
    audio.addEventListener('loadedmetadata', applyResumeTime, { once: true });
    return () => audio.removeEventListener('loadedmetadata', applyResumeTime);
  }, [currentTrackIndex, resumeTime]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const loadTrack = async () => {
      if (!currentTrack) {
        setTrackSrc(null);
        setTrackError(null);
        return;
      }

      setTrackError(null);
      setTrackSrc(null);

      const requestUrl = proxiedUrl(currentTrack.href);
      const auth = getCachedPatronAuthorizationForUrl(currentTrack.href)
        || getCachedPatronAuthorizationForUrl(bookData?.sourceUrl || '');
      const headers: Record<string, string> = {};
      if (auth) {
        headers.Authorization = buildAuthorizationHeader(auth);
      }

      try {
        const response = await fetch(requestUrl, {
          headers,
          credentials: requestUrl === currentTrack.href ? 'include' : 'omit',
        });
        if (!response.ok) {
          throw new Error(`Track request failed (${response.status}).`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setTrackSrc(objectUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setTrackError(error instanceof Error ? error.message : 'Failed to load this track.');
        }
      }
    };

    void loadTrack();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [bookData?.sourceUrl, currentTrack]);

  const persistPosition = (time: number) => {
    if (!bookId) return;
    saveLastPositionForBook(bookId, JSON.stringify({
      trackIndex: currentTrackIndex,
      time,
    } satisfies SavedAudioPosition));
  };

  if (isLoading) {
    return <Spinner message="Loading audiobook..." />;
  }

  if (manifestError || !manifest || !bookData) {
    return (
      <div className="min-h-screen theme-shell theme-text-primary flex flex-col items-center justify-center px-6">
        <p className="theme-text-secondary mb-4 text-center">{manifestError || 'Could not load the audiobook.'}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-600"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-shell theme-text-primary px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
          >
            <CloseIcon className="h-4 w-4" />
            Close
          </button>
          <div className="text-right">
            <h1 className="text-2xl font-bold md:text-3xl">{manifest.title}</h1>
            <p className="theme-text-secondary text-sm md:text-base">{manifest.author}</p>
          </div>
        </div>

        <section className="theme-surface-elevated mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl p-6 text-center shadow-xl">
          {coverImage ? (
            <img
              src={coverImage}
              alt={manifest.title}
              className="mb-6 aspect-square w-full max-w-xs rounded-2xl object-cover shadow-2xl"
            />
          ) : (
            <div className="theme-surface mx-auto mb-6 flex aspect-square w-full max-w-xs items-center justify-center rounded-2xl p-6 text-center">
              <span className="text-lg font-semibold">{manifest.title}</span>
            </div>
          )}
          <div className="w-full">
            <p className="theme-text-secondary mb-2 text-sm uppercase tracking-[0.16em]">Now Playing</p>
            <h2 className="mb-1 text-xl font-semibold">{currentTrack?.title || 'Track'}</h2>
            <audio
              key={trackSrc || currentTrackIndex}
              ref={audioRef}
              controls
              autoPlay
              preload="metadata"
              className="w-full"
              src={trackSrc || undefined}
              onEnded={() => {
                if (currentTrackIndex < manifest.tracks.length - 1) {
                  setResumeTime(0);
                  setCurrentTrackIndex((index) => index + 1);
                }
              }}
              onTimeUpdate={(event) => {
                const currentTime = event.currentTarget.currentTime;
                if (!Number.isFinite(currentTime)) return;
                saveTickRef.current += 1;
                if (saveTickRef.current % 10 === 0) {
                  persistPosition(currentTime);
                }
              }}
              onPause={(event) => persistPosition(event.currentTarget.currentTime)}
            />
            {trackError && (
              <p className="mt-3 text-sm text-amber-400">{trackError}</p>
            )}
          </div>
        </section>

        <section className="theme-surface-elevated mx-auto w-full max-w-2xl rounded-2xl p-5">
          <button
            type="button"
            onClick={() => setIsContentsOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-left"
            aria-expanded={isContentsOpen}
          >
            <span>
              <span className="theme-text-secondary block text-sm uppercase tracking-[0.16em]">Contents</span>
              <span className="theme-text-primary text-sm font-semibold">
                {manifest.toc.length > 0 ? `${manifest.toc.length} chapters` : `${manifest.tracks.length} tracks`}
              </span>
            </span>
            <span className="theme-text-secondary text-sm font-semibold">
              {isContentsOpen ? 'Hide' : 'Show'}
            </span>
          </button>

          {isContentsOpen && (
            <div className="mt-4">
              {chapterGroups.length > 0 ? (
                <div className="max-h-[55vh] space-y-4 overflow-y-auto">
                  {chapterGroups.map((group, groupIndex) => (
                    <div key={`${group.title}-${group.tocIndex}-${groupIndex}`} className="rounded-xl border border-white/10 p-3">
                      <div className="mb-2">
                        <p className="theme-text-primary text-sm font-semibold">{group.title}</p>
                        <p className="theme-text-muted text-xs">Chapter {groupIndex + 1}</p>
                      </div>
                      <div className="space-y-2">
                        {group.tracks.map(({ track, trackIndex }) => (
                          <button
                            key={`${track.href}-${trackIndex}`}
                            type="button"
                            onClick={() => {
                              setResumeTime(0);
                              setCurrentTrackIndex(trackIndex);
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                              trackIndex === currentTrackIndex
                                ? 'bg-sky-700 text-white'
                                : 'theme-hover-surface theme-text-secondary'
                            }`}
                          >
                            <span className="block font-medium">{track.title}</span>
                            <span className="theme-text-muted text-xs">Track {trackIndex + 1}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-[55vh] space-y-2 overflow-y-auto">
                  {manifest.tracks.map((track, index) => (
                    <button
                      key={`${track.href}-${index}`}
                      type="button"
                      onClick={() => {
                        setResumeTime(0);
                        setCurrentTrackIndex(index);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        index === currentTrackIndex
                          ? 'bg-sky-700 text-white'
                          : 'theme-hover-surface theme-text-secondary'
                      }`}
                    >
                      <span className="block font-medium">{track.title}</span>
                      <span className="theme-text-muted text-xs">Track {index + 1}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AudioReaderView;
