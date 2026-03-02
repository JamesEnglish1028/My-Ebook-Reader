import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { BookRecord, RequestAuthorization } from '../types';
import {
  cacheAuthDocumentForUrl,
  cachePatronAuthorizationForUrl,
  db,
  ensureFreshPatronAuthorization,
  findCredentialForUrl,
  getAuthorizationForAuthDocument,
  getCachedAuthDocumentForUrl,
  getCachedPatronAuthorizationForUrl,
  invalidatePatronAuthorizationForUrl,
  proxiedUrl,
} from '../services';
import { parseAudiobookManifest } from '../services/audiobookManifest';
import type { ParsedAudiobookManifest } from '../services/audiobookManifest';
import { getLastPositionForBook, saveLastPositionForBook } from '../services/readerUtils';

import { BackwardStepIcon, CloseIcon, ForwardStepIcon, PauseIcon, PlayIcon } from './icons';
import Spinner from './Spinner';

interface AudioReaderViewProps {
  bookId?: number;
  onClose?: () => void;
}

interface SavedAudioPosition {
  trackIndex: number;
  time: number;
  trackTimes?: Record<string, number>;
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const formatDuration = (seconds: number | undefined): string | null => {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return null;
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const clampProgress = (value: number): number => Math.max(0, Math.min(1, value));

const buildAuthorizationHeader = (auth: RequestAuthorization): string => (
  auth.scheme === 'bearer'
    ? `Bearer ${auth.token}`
    : `Basic ${btoa(`${auth.username}:${auth.password}`)}`
);

const getResponseContentType = (response: Response): string => (
  response.headers && typeof response.headers.get === 'function'
    ? (response.headers.get('Content-Type') || '')
    : ''
);

const normalizeResourceHref = (href: string): string => href.split('#')[0];

const getAudiobookAuthSourceUrl = (book: BookRecord | null): string => (
  book?.fulfillmentUrl || book?.sourceUrl || ''
);

const parseSavedAudioPosition = (saved: string | null): SavedAudioPosition | null => {
  if (!saved) return null;
  try {
    return JSON.parse(saved) as SavedAudioPosition;
  } catch {
    return null;
  }
};

const AudioReaderView: React.FC<AudioReaderViewProps> = ({ bookId: propBookId, onClose: propOnClose }) => {
  const bookId = propBookId ?? null;
  const onClose = propOnClose ?? (() => undefined);
  const [bookData, setBookData] = useState<BookRecord | null>(null);
  const [manifest, setManifest] = useState<ParsedAudiobookManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [resumeTime, setResumeTime] = useState(0);
  const [trackTimes, setTrackTimes] = useState<Record<number, number>>({});
  const [trackSrc, setTrackSrc] = useState<string | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [isContentsOpen, setIsContentsOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const saveTickRef = useRef(0);
  const trackTimesRef = useRef<Record<number, number>>({});
  trackTimesRef.current = trackTimes;

  const parseManifestData = React.useCallback((data: ArrayBuffer | string, baseUrl?: string): ParsedAudiobookManifest | null => {
    try {
      const parsed = parseAudiobookManifest(data, baseUrl);
      setManifest(parsed);
      setManifestError(null);
      return parsed;
    } catch (error) {
      setManifest(null);
      setManifestError(error instanceof Error ? error.message : 'Failed to parse audiobook manifest.');
      return null;
    }
  }, []);

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
      if (data.authDocument) {
        const authContextUrl = data.fulfillmentUrl || data.sourceUrl || data.providerId;
        if (authContextUrl) {
          cacheAuthDocumentForUrl(authContextUrl, data.authDocument);
        }
      }
      parseManifestData(data.epubData, data.manifestUrl || data.sourceUrl || data.providerId || undefined);
      const parsed = parseSavedAudioPosition(getLastPositionForBook(bookId));
      if (parsed) {
        let parsedTrackIndex = 0;
        if (Number.isFinite(parsed.trackIndex)) setCurrentTrackIndex(parsed.trackIndex);
        if (Number.isFinite(parsed.trackIndex)) parsedTrackIndex = parsed.trackIndex;
        if (Number.isFinite(parsed.time)) setResumeTime(parsed.time);
        if (parsed.trackTimes && typeof parsed.trackTimes === 'object') {
          const nextTrackTimes = Object.entries(parsed.trackTimes).reduce<Record<number, number>>((acc, [key, value]) => {
            const trackIndex = Number(key);
            if (Number.isFinite(trackIndex) && Number.isFinite(value)) {
              acc[trackIndex] = value;
            }
            return acc;
          }, {});
          setTrackTimes(nextTrackTimes);
          if (!Number.isFinite(parsed.time) && Number.isFinite(nextTrackTimes[parsedTrackIndex])) {
            setResumeTime(nextTrackTimes[parsedTrackIndex]);
          }
        }
      }
      setIsLoading(false);
    };
    void fetchBook();
  }, [bookId, parseManifestData]);

  const currentTrack = manifest?.tracks[currentTrackIndex] || null;
  const coverImage = bookData?.coverImage || manifest?.coverImageUrl || null;

  const cacheAuthorizationForManifestTracks = React.useCallback((
    parsedManifest: ParsedAudiobookManifest,
    auth: RequestAuthorization | null | undefined,
    manifestUrl?: string,
    fulfillmentUrl?: string,
  ) => {
    if (!auth) return;
    if (manifestUrl) {
      cachePatronAuthorizationForUrl(manifestUrl, auth);
    }
    if (fulfillmentUrl) {
      cachePatronAuthorizationForUrl(fulfillmentUrl, auth);
    }
    parsedManifest.tracks.forEach((track) => {
      cachePatronAuthorizationForUrl(track.href, auth);
    });
  }, []);

  const refreshManifestFromSource = React.useCallback(async (
    preferredAuth?: RequestAuthorization | null,
    forceRefresh = false,
  ) => {
    const fulfillmentUrl = bookData?.fulfillmentUrl || bookData?.sourceUrl;
    if (!fulfillmentUrl) return null;

    if (forceRefresh) {
      invalidatePatronAuthorizationForUrl(fulfillmentUrl);
      if (bookData?.manifestUrl) {
        invalidatePatronAuthorizationForUrl(bookData.manifestUrl);
      }
    }

    let auth = preferredAuth || getCachedPatronAuthorizationForUrl(fulfillmentUrl);
    if (!auth) {
      const refreshed = await ensureFreshPatronAuthorization(fulfillmentUrl, 0);
      auth = refreshed.authorization;
    }

    const headers: Record<string, string> = {};
    if (auth) {
      headers.Authorization = buildAuthorizationHeader(auth);
    }

    const requestUrl = proxiedUrl(fulfillmentUrl);
    let response = await fetch(requestUrl, {
      headers,
      credentials: requestUrl === fulfillmentUrl ? 'include' : 'omit',
    });

    if (!response.ok) {
      throw new Error(`Manifest request failed (${response.status}).`);
    }

    let manifestUrl = bookData.manifestUrl || bookData.sourceUrl || fulfillmentUrl;
    let manifestBuffer: ArrayBuffer;
    let refreshedManifestAuth: RequestAuthorization | null = auth;
    const responseContentType = getResponseContentType(response).toLowerCase();

    if (responseContentType.includes('application/vnd.librarysimplified.bearer-token+json')) {
      const payload = await response.json().catch(() => null as any);
      const accessToken = typeof payload?.access_token === 'string'
        ? payload.access_token
        : typeof payload?.accessToken === 'string'
          ? payload.accessToken
          : null;
      const tokenType = typeof payload?.token_type === 'string'
        ? payload.token_type
        : typeof payload?.tokenType === 'string'
          ? payload.tokenType
          : 'Bearer';
      const location = typeof payload?.location === 'string' ? payload.location : null;

      if (!accessToken || !location) {
        throw new Error('Manifest refresh returned an incomplete bearer-token document.');
      }

      manifestUrl = new URL(location, response.url || fulfillmentUrl).href;
      const manifestAuth: RequestAuthorization | null = String(tokenType).toLowerCase() === 'bearer'
        ? { scheme: 'bearer', token: accessToken }
        : null;
      refreshedManifestAuth = manifestAuth;

      if (manifestAuth) {
        cachePatronAuthorizationForUrl(manifestUrl, manifestAuth);
      }

      const manifestRequestUrl = proxiedUrl(manifestUrl);
      response = await fetch(manifestRequestUrl, {
        headers: manifestAuth ? { Authorization: `${tokenType} ${accessToken}` } : {},
        credentials: manifestRequestUrl === manifestUrl ? 'include' : 'omit',
      });

      if (!response.ok) {
        throw new Error(`Manifest request failed (${response.status}).`);
      }
    }

    manifestBuffer = await response.arrayBuffer();
    const parsed = parseManifestData(manifestBuffer, manifestUrl || bookData.providerId || undefined);
    if (!parsed) {
      throw new Error('Failed to parse refreshed audiobook manifest.');
    }

    cacheAuthorizationForManifestTracks(
      parsed,
      refreshedManifestAuth,
      manifestUrl,
      fulfillmentUrl,
    );

    setBookData((existing) => (
      existing
        ? {
            ...existing,
            epubData: manifestBuffer,
            sourceUrl: manifestUrl,
            manifestUrl,
          }
        : existing
    ));

    return parsed;
  }, [bookData, cacheAuthorizationForManifestTracks, parseManifestData]);

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
      const tracks = manifest.tracks
        .slice(group.startIndex, endExclusive)
        .map((track, trackOffset) => ({
          track,
          trackIndex: group.startIndex + trackOffset,
        }));
      const duration = tracks.reduce((total, entry) => total + (entry.track.duration || 0), 0);
      return {
        title: group.title,
        tocIndex: group.tocIndex,
        duration,
        tracks,
        startTrackIndex: group.startIndex,
        endTrackIndex: endExclusive - 1,
      };
    });
  }, [manifest]);

  const getSavedTrackTime = React.useCallback((trackIndex: number): number => {
    const savedTime = trackTimesRef.current[trackIndex];
    return Number.isFinite(savedTime) && savedTime > 0 ? savedTime : 0;
  }, []);

  const updateTrackTime = React.useCallback((trackIndex: number, time: number): Record<number, number> => {
    const normalizedTime = Math.max(0, time);
    const nextTrackTimes = {
      ...trackTimesRef.current,
      [trackIndex]: normalizedTime,
    };
    trackTimesRef.current = nextTrackTimes;
    setTrackTimes(nextTrackTimes);
    return nextTrackTimes;
  }, []);

  const getTrackProgress = React.useCallback((trackIndex: number, trackDuration?: number) => {
    const listenedSeconds = trackIndex === currentTrackIndex
      ? Math.max(currentTime, getSavedTrackTime(trackIndex))
      : getSavedTrackTime(trackIndex);

    if (listenedSeconds <= 0) {
      return {
        state: 'not-started' as const,
        listenedSeconds: 0,
        progress: 0,
      };
    }

    if (trackDuration && listenedSeconds >= trackDuration) {
      return {
        state: 'completed' as const,
        listenedSeconds: trackDuration,
        progress: 1,
      };
    }

    return {
      state: 'in-progress' as const,
      listenedSeconds,
      progress: trackDuration && trackDuration > 0 ? clampProgress(listenedSeconds / trackDuration) : null,
    };
  }, [currentTime, getSavedTrackTime]);

  const getGroupProgress = React.useCallback((
    startTrackIndex: number,
    endTrackIndex: number,
    tracks: { track: { duration?: number } }[],
    totalDuration: number,
  ) => {
    let listenedSeconds = 0;
    let allComplete = tracks.length > 0;

    for (let index = startTrackIndex; index <= endTrackIndex; index += 1) {
      const relativeIndex = index - startTrackIndex;
      const trackDuration = tracks[relativeIndex]?.track.duration;
      const progress = getTrackProgress(index, trackDuration);
      listenedSeconds += progress.listenedSeconds;
      if (progress.state !== 'completed') {
        allComplete = false;
      }
    }

    if (listenedSeconds <= 0) {
      return {
        state: 'not-started' as const,
        listenedSeconds: 0,
        progress: 0,
      };
    }

    if (allComplete) {
      return {
        state: 'completed' as const,
        listenedSeconds: totalDuration || listenedSeconds,
        progress: totalDuration > 0 ? 1 : null,
      };
    }

    return {
      state: 'in-progress' as const,
      listenedSeconds,
      progress: totalDuration > 0 ? clampProgress(listenedSeconds / totalDuration) : null,
    };
  }, [getTrackProgress]);

  const requestTrackResponse = React.useCallback(async (
    href: string,
    auth: RequestAuthorization | null,
  ): Promise<Response> => {
    const requestUrl = proxiedUrl(href);
    const headers: Record<string, string> = {};
    if (auth) {
      headers.Authorization = buildAuthorizationHeader(auth);
    }
    return fetch(requestUrl, {
      headers,
      credentials: requestUrl === href ? 'include' : 'omit',
    });
  }, []);

  const refreshTrackAuthorization = React.useCallback(async (
    trackHref: string,
    forceRefresh = false,
  ): Promise<RequestAuthorization | null> => {
    const sourceUrl = getAudiobookAuthSourceUrl(bookData);
    if (!sourceUrl) return null;

    const storedCredential = await findCredentialForUrl(sourceUrl);
    if (!storedCredential) return null;
    const authDocument = getCachedAuthDocumentForUrl(sourceUrl) || bookData?.authDocument || null;

    if (forceRefresh) {
      invalidatePatronAuthorizationForUrl(sourceUrl);
      invalidatePatronAuthorizationForUrl(trackHref);
    }

    if (!authDocument) {
      const basicAuth: RequestAuthorization = {
        scheme: 'basic',
        username: storedCredential.username,
        password: storedCredential.password,
      };
      cachePatronAuthorizationForUrl(sourceUrl, basicAuth);
      cachePatronAuthorizationForUrl(trackHref, basicAuth);
      return basicAuth;
    }

    const freshAuth = await getAuthorizationForAuthDocument(
      authDocument,
      sourceUrl,
      storedCredential.username,
      storedCredential.password,
      { forceRefresh },
    );

    cachePatronAuthorizationForUrl(trackHref, freshAuth);
    return freshAuth;
  }, [bookData]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, trackSrc]);

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
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);

      const sourceUrl = getAudiobookAuthSourceUrl(bookData);

      try {
        let auth = getCachedPatronAuthorizationForUrl(currentTrack.href)
          || getCachedPatronAuthorizationForUrl(sourceUrl);
        let activeTrackHref = currentTrack.href;

        if (!auth) {
          auth = await refreshTrackAuthorization(currentTrack.href);
        }

        let response = await requestTrackResponse(activeTrackHref, auth);
        if (response.status === 401) {
          const refreshedAuth = await refreshTrackAuthorization(currentTrack.href, true);
          if (refreshedAuth) {
            auth = refreshedAuth;
            try {
              const refreshedManifest = await refreshManifestFromSource(refreshedAuth, true);
              const refreshedTrack = refreshedManifest?.tracks[currentTrackIndex];
              if (refreshedTrack?.href) {
                activeTrackHref = refreshedTrack.href;
              }
              const propagatedAuth = getCachedPatronAuthorizationForUrl(activeTrackHref) || refreshedAuth;
              cachePatronAuthorizationForUrl(activeTrackHref, propagatedAuth);
            } catch {
              // Fall back to retrying the previous URL with fresh auth.
            }
            response = await requestTrackResponse(
              activeTrackHref,
              getCachedPatronAuthorizationForUrl(activeTrackHref) || refreshedAuth,
            );
          }
        }

        if (!response.ok && (response.status === 401 || response.status === 403) && sourceUrl) {
          try {
            const refreshedManifest = await refreshManifestFromSource(null, true);
            const refreshedTrack = refreshedManifest?.tracks[currentTrackIndex];
            if (refreshedTrack?.href && refreshedTrack.href !== activeTrackHref) {
              const refreshedAuth = getCachedPatronAuthorizationForUrl(refreshedTrack.href)
                || getCachedPatronAuthorizationForUrl(sourceUrl)
                || auth;
              response = await requestTrackResponse(refreshedTrack.href, refreshedAuth);
            }
          } catch {
            // Preserve the original response error below.
          }
        }

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
  }, [bookData, currentTrack, currentTrackIndex, refreshManifestFromSource, refreshTrackAuthorization, requestTrackResponse]);

  const persistPosition = (time: number, nextTrackTimes?: Record<number, number>) => {
    if (!bookId) return;
    const mergedTrackTimes = nextTrackTimes || {
      ...trackTimesRef.current,
      [currentTrackIndex]: Math.max(0, time),
    };
    trackTimesRef.current = mergedTrackTimes;
    setTrackTimes(mergedTrackTimes);
    saveLastPositionForBook(bookId, JSON.stringify({
      trackIndex: currentTrackIndex,
      time,
      trackTimes: Object.fromEntries(
        Object.entries(mergedTrackTimes)
          .filter(([, value]) => Number.isFinite(value) && value > 0)
          .map(([key, value]) => [key, Math.max(0, value)]),
      ),
    } satisfies SavedAudioPosition));
  };

  const seekBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : Number.POSITIVE_INFINITY;
    const nextTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    const nextTrackTimes = updateTrackTime(currentTrackIndex, nextTime);
    persistPosition(nextTime, nextTrackTimes);
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        // Ignore play interruption errors from browser autoplay policies.
      }
    } else {
      audio.pause();
    }
  };

  const jumpToTrack = (trackIndex: number) => {
    const currentAudioTime = audioRef.current?.currentTime;
    if (Number.isFinite(currentAudioTime)) {
      const nextTrackTimes = updateTrackTime(currentTrackIndex, currentAudioTime as number);
      persistPosition(currentAudioTime as number, nextTrackTimes);
    }
    setResumeTime(getSavedTrackTime(trackIndex));
    setCurrentTrackIndex(trackIndex);
  };

  if (isLoading) {
    return <Spinner text="Loading audiobook..." />;
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
            <div className="mb-4 mt-4">
              <div className="mb-3">
                <input
                  type="range"
                  min={0}
                  max={Number.isFinite(duration) && duration > 0 ? duration : 0}
                  step={1}
                  value={Math.min(currentTime, Number.isFinite(duration) && duration > 0 ? duration : 0)}
                  onChange={(event) => {
                    const nextTime = Number(event.target.value);
                    const audio = audioRef.current;
                    if (!audio || !Number.isFinite(nextTime)) return;
                    audio.currentTime = nextTime;
                    setCurrentTime(nextTime);
                    const nextTrackTimes = updateTrackTime(currentTrackIndex, nextTime);
                    persistPosition(nextTime, nextTrackTimes);
                  }}
                  className="w-full accent-sky-600"
                  aria-label="Playback position"
                />
                <div className="theme-text-secondary mt-2 flex items-center justify-between text-xs font-semibold">
                  <span>{formatDuration(currentTime) || '0:00'}</span>
                  <span>{formatDuration(duration) || '--:--'}</span>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => seekBy(-15)}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-white transition-colors hover:bg-slate-600"
                  aria-label="Rewind 15 seconds"
                >
                  <BackwardStepIcon className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => { void togglePlayback(); }}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-700 text-white transition-colors hover:bg-sky-600"
                  aria-label={isPlaying ? 'Pause playback' : 'Play audiobook'}
                >
                  {isPlaying ? <PauseIcon className="h-8 w-8" /> : <PlayIcon className="h-8 w-8" />}
                </button>
                <button
                  type="button"
                  onClick={() => seekBy(30)}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-white transition-colors hover:bg-slate-600"
                  aria-label="Fast forward 30 seconds"
                >
                  <ForwardStepIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="theme-text-secondary text-sm font-semibold">Speed</span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setPlaybackRate(speed)}
                      className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                        playbackRate === speed
                          ? 'bg-sky-700 text-white'
                          : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <audio
              key={trackSrc || currentTrackIndex}
              ref={audioRef}
              autoPlay
              preload="metadata"
              className="hidden"
              src={trackSrc || undefined}
              onLoadedMetadata={(event) => {
                const audio = event.currentTarget;
                const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
                const targetResumeTime = Math.max(resumeTime, getSavedTrackTime(currentTrackIndex));
                if (Number.isFinite(targetResumeTime) && targetResumeTime > 0) {
                  try {
                    audio.currentTime = Math.min(targetResumeTime, nextDuration || targetResumeTime);
                  } catch {
                    // ignore seek failures
                  }
                }
                setDuration(nextDuration);
                setCurrentTime(audio.currentTime || 0);
                audio.playbackRate = playbackRate;
              }}
              onEnded={() => {
                setIsPlaying(false);
                const completedTrackTimes = updateTrackTime(currentTrackIndex, duration || currentTime);
                persistPosition(duration || currentTime, completedTrackTimes);
                if (currentTrackIndex < manifest.tracks.length - 1) {
                  const nextTrackIndex = currentTrackIndex + 1;
                  setResumeTime(getSavedTrackTime(nextTrackIndex));
                  setCurrentTrackIndex(nextTrackIndex);
                }
              }}
              onTimeUpdate={(event) => {
                const currentTime = event.currentTarget.currentTime;
                if (!Number.isFinite(currentTime)) return;
                setCurrentTime(currentTime);
                saveTickRef.current += 1;
                if (saveTickRef.current % 10 === 0) {
                  const nextTrackTimes = updateTrackTime(currentTrackIndex, currentTime);
                  persistPosition(currentTime, nextTrackTimes);
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={(event) => {
                setIsPlaying(false);
                const nextTrackTimes = updateTrackTime(currentTrackIndex, event.currentTarget.currentTime);
                persistPosition(event.currentTarget.currentTime, nextTrackTimes);
              }}
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
                <div className="max-h-[55vh] space-y-2 overflow-y-auto">
                  {chapterGroups.map((group, groupIndex) => {
                    const progress = getGroupProgress(
                      group.startTrackIndex,
                      group.endTrackIndex,
                      group.tracks,
                      group.duration,
                    );
                    const isActive = currentTrackIndex >= group.startTrackIndex && currentTrackIndex <= group.endTrackIndex;
                    const detailTextClass = isActive ? 'theme-on-accent-text-muted' : 'theme-text-muted';
                    const statusTextClass = isActive ? 'theme-on-accent-text-muted' : 'theme-text-muted';

                    return (
                      <button
                        key={`${group.title}-${group.tocIndex}-${groupIndex}`}
                        type="button"
                        onClick={() => {
                          jumpToTrack(group.startTrackIndex);
                        }}
                        className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                          isActive
                            ? 'border-sky-600 bg-sky-700 text-white'
                            : 'border-white/10 theme-hover-surface theme-text-secondary'
                        }`}
                      >
                        <span className="block font-medium">{group.title}</span>
                        <span className={`${detailTextClass} text-xs`}>
                          {group.startTrackIndex === group.endTrackIndex
                            ? `Track ${group.startTrackIndex + 1}`
                            : `Tracks ${group.startTrackIndex + 1}-${group.endTrackIndex + 1}`}
                          {formatDuration(group.duration) ? ` · ${formatDuration(group.duration)}` : ''}
                        </span>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`${statusTextClass} min-w-20 text-[11px] font-semibold uppercase tracking-[0.08em]`}>
                            {progress.state === 'completed'
                              ? 'Finished'
                              : progress.state === 'in-progress'
                                ? 'In Progress'
                                : 'Not Started'}
                          </span>
                          {typeof progress.progress === 'number' && (
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/20">
                              <div
                                className="h-full rounded-full bg-sky-400"
                                style={{ width: `${Math.round(progress.progress * 100)}%` }}
                              />
                            </div>
                          )}
                          {progress.state !== 'not-started' && (
                            <span className={`${statusTextClass} text-[11px] font-semibold`}>
                              {formatDuration(progress.listenedSeconds) || '0:00'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="max-h-[55vh] space-y-2 overflow-y-auto">
                  {manifest.tracks.map((track, index) => {
                    const progress = getTrackProgress(index, track.duration);
                    const isActive = index === currentTrackIndex;
                    const detailTextClass = isActive ? 'theme-on-accent-text-muted' : 'theme-text-muted';
                    const statusTextClass = isActive ? 'theme-on-accent-text-muted' : 'theme-text-muted';
                    return (
                      <button
                        key={`${track.href}-${index}`}
                        type="button"
                        onClick={() => {
                          jumpToTrack(index);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? 'bg-sky-700 text-white'
                            : 'theme-hover-surface theme-text-secondary'
                        }`}
                      >
                        <span className="block font-medium">{track.title}</span>
                        <span className={`${detailTextClass} text-xs`}>
                          Track {index + 1}
                          {formatDuration(track.duration) ? ` · ${formatDuration(track.duration)}` : ''}
                        </span>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`${statusTextClass} min-w-20 text-[11px] font-semibold uppercase tracking-[0.08em]`}>
                            {progress.state === 'completed'
                              ? 'Finished'
                              : progress.state === 'in-progress'
                                ? 'In Progress'
                                : 'Not Started'}
                          </span>
                          {typeof progress.progress === 'number' && (
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/20">
                              <div
                                className="h-full rounded-full bg-sky-400"
                                style={{ width: `${Math.round(progress.progress * 100)}%` }}
                              />
                            </div>
                          )}
                          {progress.state !== 'not-started' && (
                            <span className={`${statusTextClass} text-[11px] font-semibold`}>
                              {formatDuration(progress.listenedSeconds) || '0:00'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
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
