import type { BookRecord } from '../domain/book/types';
import type { DriveSnapshot, SyncPayload } from '../domain/sync/types';

import { logger } from './logger';

const GOOGLE_CLIENT_ID = ((import.meta as any)?.env?.VITE_GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_INIT_TIMEOUT_MS = Number((import.meta as any)?.env?.VITE_GOOGLE_INIT_TIMEOUT_MS || 12000);
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'profile',
  'email',
].join(' ');
const APP_FOLDER_NAME = 'Custom Ebook Reader Library';
const BOOKS_SUBFOLDER_NAME = 'books';
const METADATA_FILE_NAME = 'library.json';
const LATEST_POINTER_FILE_NAME = 'latest.json';
const SNAPSHOT_PREFIX = 'library-snapshot-';
const TOKEN_EXPIRY_KEY = 'g_access_token_expires_at';
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 400;

let gapiInited = false;
let gisInited = false;
let tokenClient: any = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetriableStatus = (status?: number) => status === 429 || (typeof status === 'number' && status >= 500 && status < 600);

const toStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: number; code?: number };
  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.code === 'number') return candidate.code;
  return undefined;
};

const toUserFacingError = (error: unknown, fallback: string): Error => {
  const status = toStatus(error);
  if (status === 401 || status === 403) {
    return new Error('Google session expired or permission was revoked. Please sign in again.');
  }
  if (error && typeof error === 'object') {
    const candidate = error as { error?: string; details?: string; message?: string };
    const parts = [candidate.error, candidate.details, candidate.message].filter((v): v is string => Boolean(v && v.trim().length > 0));
    if (parts.length > 0) {
      return new Error(parts.join(' - '));
    }
  }
  if (error instanceof Error) return error;
  return new Error(fallback);
};

async function withRetry<T>(label: string, op: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      return await op();
    } catch (error) {
      attempt += 1;
      const status = toStatus(error);
      const shouldRetry = isRetriableStatus(status) || (error instanceof TypeError && error.message === 'Failed to fetch');

      if (!shouldRetry || attempt >= MAX_RETRIES) {
        throw error;
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn(`[google] ${label} failed, retrying`, { attempt, delay, status, error });
      await sleep(delay);
    }
  }

  throw new Error(`[google] ${label} failed after retries`);
}

function ensureGoogleClientConfigured() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google sync is not configured. Set VITE_GOOGLE_CLIENT_ID in your environment.');
  }
}

const waitForGlobal = (key: 'gapi' | 'google', subkey?: string, timeoutMs = GOOGLE_INIT_TIMEOUT_MS): Promise<any> => {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const interval = setInterval(() => {
      const globalObj = window[key];
      const ready = Boolean(globalObj && (!subkey || (globalObj as any)[subkey]));
      if (ready) {
        clearInterval(interval);
        resolve(globalObj);
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for Google SDK (${key}${subkey ? `.${subkey}` : ''}) after ${timeoutMs}ms.`));
      }
    }, 100);
  });
};

const ensureGapiInitialized = async () => {
  if (gapiInited) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out loading gapi client after ${GOOGLE_INIT_TIMEOUT_MS}ms.`));
    }, GOOGLE_INIT_TIMEOUT_MS);

    window.gapi.load('client', () => {
      void window.gapi.client.init({
        // OAuth is handled via Google Identity Services token client.
        // gapi client only needs discovery docs for Drive API calls.
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      }).then(() => {
        gapiInited = true;
        clearTimeout(timeout);
        resolve();
      }).catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });
};

const getAccessTokenOrThrow = () => {
  const token = window.gapi?.client?.getToken?.();
  const accessToken = token?.access_token;

  if (!accessToken) {
    throw new Error('Google session not available. Please sign in before syncing.');
  }

  let tokenExpiryMs: number | null = null;
  if (typeof token?.expires_at === 'number' && Number.isFinite(token.expires_at)) {
    // Some SDK responses use seconds, others milliseconds.
    tokenExpiryMs = token.expires_at > 1e12 ? token.expires_at : token.expires_at * 1000;
  }
  if (tokenExpiryMs !== null && tokenExpiryMs <= Date.now() + 60000) {
    throw new Error('Google session expired. Please sign in again.');
  }

  // Fallback to stored expiry only when gapi token does not provide one.
  const storedExpiryRaw = localStorage.getItem(TOKEN_EXPIRY_KEY);
  const storedExpiry = storedExpiryRaw ? Number(storedExpiryRaw) : NaN;
  if (tokenExpiryMs === null && Number.isFinite(storedExpiry) && storedExpiry <= Date.now() + 60000) {
    // Clear stale expiry marker so a fresh in-memory token can still be attempted.
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  return accessToken;
};

async function driveList(params: Record<string, unknown>): Promise<any> {
  return withRetry('drive.files.list', () => window.gapi.client.drive.files.list(params));
}

async function driveCreate(params: Record<string, unknown>): Promise<any> {
  return withRetry('drive.files.create', () => window.gapi.client.drive.files.create(params));
}

async function driveGet(params: Record<string, unknown>): Promise<any> {
  return withRetry('drive.files.get', () => window.gapi.client.drive.files.get(params));
}

const toSnapshotFileName = (date: Date) => {
  const safe = date.toISOString().replace(/[:.]/g, '-');
  return `${SNAPSHOT_PREFIX}${safe}.json`;
};

async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  return withRetry(label, async () => {
    const response = await fetch(url, init);
    if (!response.ok) {
      const err: any = new Error(`${label} failed: ${response.status} ${response.statusText}`);
      err.status = response.status;
      throw err;
    }
    return response;
  });
}

export const initGoogleClient = (callback: (resp: any) => void): Promise<any> => {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        ensureGoogleClientConfigured();
        await Promise.all([waitForGlobal('gapi'), waitForGlobal('google', 'accounts')]);

        if (!gisInited) {
          tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_SCOPES,
            callback,
          });
          gisInited = true;
        }

        await ensureGapiInitialized();
        resolve(tokenClient);
      } catch (error) {
        logger.error('Error during Google Client initialization:', error);
        reject(toUserFacingError(error, 'Failed to initialize Google Client.'));
      }
    })();
  });
};

export const revokeToken = (token: string) => {
  if (!window.google?.accounts?.oauth2) return;
  window.google.accounts.oauth2.revoke(token, () => {
    logger.info('Access token revoked.');
  });
};

const findOrCreateFolder = async (folderName: string, parentId?: string): Promise<string> => {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false` + (parentId ? ` and '${parentId}' in parents` : '');

  const response = await driveList({ q });

  if (response.result.files && response.result.files.length > 0) {
    return response.result.files[0].id;
  }

  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentId && { parents: [parentId] }),
  };

  const createResponse = await driveCreate({
    resource: fileMetadata,
    fields: 'id',
  });

  return createResponse.result.id;
};

const findFileByName = async (folderId: string, fileName: string): Promise<{ id: string; name: string } | null> => {
  const q = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
  const listResponse = await driveList({ q, fields: 'files(id,name)' });
  if (listResponse.result.files && listResponse.result.files.length > 0) {
    return listResponse.result.files[0];
  }
  return null;
};

const upsertJsonFile = async (folderId: string, fileName: string, data: unknown): Promise<string> => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const existing = await findFileByName(folderId, fileName);
  if (existing?.id) {
    await updateFile(existing.id, blob, 'application/json');
    return existing.id;
  }
  return uploadFile(folderId, fileName, blob, 'application/json');
};

const uploadFile = async (folderId: string, fileName: string, fileData: Blob | ArrayBuffer, mimeType: string): Promise<string> => {
  const metadata = { name: fileName, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([fileData], { type: mimeType }));

  const accessToken = getAccessTokenOrThrow();
  const response = await fetchWithRetry(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: new Headers({ Authorization: `Bearer ${accessToken}` }),
      body: form,
    },
    'drive.uploadFile',
  );

  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return result.id;
};

const updateFile = async (fileId: string, fileData: Blob | ArrayBuffer, mimeType: string) => {
  const accessToken = getAccessTokenOrThrow();
  const response = await fetchWithRetry(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: new Headers({ Authorization: `Bearer ${accessToken}`, 'Content-Type': mimeType }),
      body: fileData,
    },
    'drive.updateFile',
  );

  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return result;
};

export const uploadLibraryToDrive = async (payload: SyncPayload, books: BookRecord[], onProgress: (message: string) => void) => {
  try {
    getAccessTokenOrThrow();

    const appFolderId = await findOrCreateFolder(APP_FOLDER_NAME);
    localStorage.setItem('ebook-reader-drive-folder-id', appFolderId);

    onProgress(`Uploading ${books.length} book files...`);
    const booksFolderId = await findOrCreateFolder(BOOKS_SUBFOLDER_NAME, appFolderId);

    const bookFileUploads = books.map(async (book, index) => {
      onProgress(`Uploading book ${index + 1}/${books.length}: ${book.title}`);
      const format = (book.format || 'epub').toLowerCase();
      const mimeType = format === 'pdf' ? 'application/pdf' : 'application/epub+zip';
      const fileName = `${book.id}.${format}`;
      await uploadFile(booksFolderId, fileName, book.epubData, mimeType);
    });
    await Promise.all(bookFileUploads);

    onProgress('Uploading library metadata...');
    const snapshotDate = new Date();
    const snapshotFileName = toSnapshotFileName(snapshotDate);
    const snapshotFileId = await upsertJsonFile(appFolderId, snapshotFileName, payload);

    // Keep legacy latest metadata file for backward compatibility.
    await upsertJsonFile(appFolderId, METADATA_FILE_NAME, payload);

    // Keep a pointer file to latest snapshot for deterministic restores.
    await upsertJsonFile(appFolderId, LATEST_POINTER_FILE_NAME, {
      latestSnapshotFileId: snapshotFileId,
      latestSnapshotFileName: snapshotFileName,
      updatedAt: snapshotDate.toISOString(),
      version: 1,
    });

    onProgress('Upload complete!');
  } catch (error) {
    throw toUserFacingError(error, 'Upload failed.');
  }
};

export const listDriveSnapshots = async (): Promise<DriveSnapshot[]> => {
  try {
    getAccessTokenOrThrow();
    const appFolderId = await findOrCreateFolder(APP_FOLDER_NAME);

    let latestFileId: string | undefined;
    let latestFileName: string | undefined;
    const latestPointer = await findFileByName(appFolderId, LATEST_POINTER_FILE_NAME);
    if (latestPointer?.id) {
      try {
        const latestPointerResponse = await driveGet({ fileId: latestPointer.id, alt: 'media' });
        const pointerBody = JSON.parse(latestPointerResponse.body || '{}');
        latestFileId = typeof pointerBody.latestSnapshotFileId === 'string' ? pointerBody.latestSnapshotFileId : undefined;
        latestFileName = typeof pointerBody.latestSnapshotFileName === 'string' ? pointerBody.latestSnapshotFileName : undefined;
      } catch (error) {
        logger.warn('Failed to parse latest.json pointer', error);
      }
    }

    const q = `'${appFolderId}' in parents and name contains '${SNAPSHOT_PREFIX}' and trashed=false`;
    const response = await driveList({
      q,
      fields: 'files(id,name,createdTime,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
    });

    const files: any[] = Array.isArray(response?.result?.files) ? response.result.files : [];
    const snapshots = files
      .filter((file) => typeof file?.id === 'string' && typeof file?.name === 'string')
      .map((file) => ({
        id: file.id as string,
        name: file.name as string,
        createdAt: (file.createdTime || file.modifiedTime || new Date(0).toISOString()) as string,
        isLatest: (latestFileId && latestFileId === file.id) || (latestFileName && latestFileName === file.name) || false,
      })) satisfies DriveSnapshot[];

    // Backward-compat fallback if no snapshots exist yet.
    if (snapshots.length === 0) {
      const legacy = await findFileByName(appFolderId, METADATA_FILE_NAME);
      if (legacy?.id) {
        return [{
          id: legacy.id,
          name: METADATA_FILE_NAME,
          createdAt: new Date(0).toISOString(),
          isLatest: true,
        }];
      }
    }

    return snapshots;
  } catch (error) {
    throw toUserFacingError(error, 'Failed to list Drive snapshots.');
  }
};

export const downloadLibraryFromDrive = async (
  onProgress: (message: string) => void,
  snapshotFileId?: string,
): Promise<{ payload: SyncPayload; booksWithData: BookRecord[] } | null> => {
  try {
    getAccessTokenOrThrow();

    onProgress('Finding app folder in Drive...');
    const appFolderId = await findOrCreateFolder(APP_FOLDER_NAME);

    onProgress('Resolving metadata snapshot...');
    let metadataFileId = snapshotFileId;

    if (!metadataFileId) {
      const latestPointer = await findFileByName(appFolderId, LATEST_POINTER_FILE_NAME);
      if (latestPointer?.id) {
        try {
          const latestPointerResponse = await driveGet({ fileId: latestPointer.id, alt: 'media' });
          const pointerBody = JSON.parse(latestPointerResponse.body || '{}');
          if (typeof pointerBody.latestSnapshotFileId === 'string') {
            metadataFileId = pointerBody.latestSnapshotFileId;
          } else if (typeof pointerBody.latestSnapshotFileName === 'string') {
            const byName = await findFileByName(appFolderId, pointerBody.latestSnapshotFileName);
            metadataFileId = byName?.id;
          }
        } catch (error) {
          logger.warn('Failed to resolve latest snapshot pointer; falling back to library.json', error);
        }
      }
    }

    if (!metadataFileId) {
      const legacy = await findFileByName(appFolderId, METADATA_FILE_NAME);
      metadataFileId = legacy?.id;
    }

    if (!metadataFileId) {
      return null;
    }

    onProgress('Downloading library metadata...');
    const fileResponse = await driveGet({
      fileId: metadataFileId,
      alt: 'media',
    });

    const payload: SyncPayload = JSON.parse(fileResponse.body);

    onProgress('Finding books subfolder...');
    const booksFolderId = await findOrCreateFolder(BOOKS_SUBFOLDER_NAME, appFolderId);

    const booksWithData: BookRecord[] = [];

    for (let i = 0; i < payload.library.length; i++) {
      const bookMeta = payload.library[i];
      if (!bookMeta.id) {
        logger.warn(`Book metadata for "${bookMeta.title}" is missing an ID, skipping download.`);
        continue;
      }

      onProgress(`Downloading book ${i + 1}/${payload.library.length}: ${bookMeta.title}`);

      const format = (bookMeta.format || 'epub').toLowerCase();
      const fileName = `${bookMeta.id}.${format}`;

      const bookFileQ = `'${booksFolderId}' in parents and name='${fileName}' and trashed=false`;
      const bookFileList = await driveList({ q: bookFileQ });

      if (!(bookFileList.result.files && bookFileList.result.files.length > 0)) {
        logger.warn(`Book file for "${bookMeta.title}" (ID: ${bookMeta.id}, filename: ${fileName}) not found in Drive.`);
        continue;
      }

      const bookFileId = bookFileList.result.files[0].id;

      try {
        const accessToken = getAccessTokenOrThrow();
        const response = await fetchWithRetry(
          `https://www.googleapis.com/drive/v3/files/${bookFileId}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
          'drive.downloadBookFile',
        );
        const epubData = await response.arrayBuffer();

        const bookRecord: BookRecord = {
          ...bookMeta,
          epubData,
        };
        booksWithData.push(bookRecord);
      } catch (error) {
        logger.warn(`Failed to download book file for "${bookMeta.title}" (ID: ${bookMeta.id}).`, error);
      }
    }

    onProgress('Download complete!');
    return { payload, booksWithData };
  } catch (error) {
    throw toUserFacingError(error, 'Download failed.');
  }
};
