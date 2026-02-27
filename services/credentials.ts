import { logger } from './logger';

const DB_NAME = 'MeBooksCredentialsDB';
const STORE_NAME = 'credentials';
const META_STORE_NAME = 'meta';
const DB_VERSION = 2;
const KEY_RECORD_ID = 'credential-encryption-key';

interface Cred {
  host: string;
  username: string;
  password: string;
}

interface CredRecord {
  host: string;
  username: string;
  password?: string;
  passwordCipher?: string;
  iv?: string;
  v?: 2;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'host' });
      }
      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        db.createObjectStore(META_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getOrCreateCryptoKey(db: IDBDatabase): Promise<CryptoKey | null> {
  if (!globalThis.crypto?.subtle) return null;

  const tx = db.transaction(META_STORE_NAME, 'readwrite');
  const metaStore = tx.objectStore(META_STORE_NAME);

  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const req = metaStore.get(KEY_RECORD_ID);
    req.onsuccess = () => resolve(req.result?.key as CryptoKey | undefined);
    req.onerror = () => reject(req.error);
  });

  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  await new Promise<void>((resolve, reject) => {
    const putReq = metaStore.put({ id: KEY_RECORD_ID, key });
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return key;
}

async function encryptSecret(key: CryptoKey, value: string): Promise<{ cipher: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    cipher: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

async function decryptSecret(key: CryptoKey, cipherText: string, ivB64: string): Promise<string> {
  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(cipherText);
  const ivBytes = new Uint8Array(iv.byteLength);
  ivBytes.set(iv);
  const cipherBytes = new Uint8Array(ciphertext.byteLength);
  cipherBytes.set(ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, cipherBytes);
  return new TextDecoder().decode(new Uint8Array(decrypted));
}

async function toCredential(record: CredRecord, key: CryptoKey | null): Promise<Cred | undefined> {
  if (record.passwordCipher && record.iv && key) {
    try {
      const password = await decryptSecret(key, record.passwordCipher, record.iv);
      return { host: record.host, username: record.username, password };
    } catch (error) {
      logger.warn('Failed to decrypt stored credential', { host: record.host, error });
      return undefined;
    }
  }

  if (record.password) {
    return { host: record.host, username: record.username, password: record.password };
  }

  return undefined;
}

export async function saveCredential(host: string, username: string, password: string) {
  try {
    const db = await openDB();
    const key = await getOrCreateCryptoKey(db);
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    let payload: CredRecord = { host, username, password };
    if (key) {
      const encrypted = await encryptSecret(key, password);
      payload = {
        host,
        username,
        passwordCipher: encrypted.cipher,
        iv: encrypted.iv,
        v: 2,
      };
    }

    store.put(payload);
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logger.warn('saveCredential failed', e);
  }
}

export async function getAllCredentials(): Promise<Cred[]> {
  try {
    const db = await openDB();
    const key = await getOrCreateCryptoKey(db);
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    const rows = await new Promise<CredRecord[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as CredRecord[]) || []);
      req.onerror = () => reject(req.error);
    });

    const credentials = await Promise.all(rows.map((row) => toCredential(row, key)));
    return credentials.filter((c): c is Cred => Boolean(c));
  } catch (e) {
    logger.warn('getAllCredentials failed', e);
    return [];
  }
}

export async function findCredential(host: string): Promise<Cred | undefined> {
  try {
    const db = await openDB();
    const key = await getOrCreateCryptoKey(db);
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(host);
    const row = await new Promise<CredRecord | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as CredRecord | undefined);
      req.onerror = () => reject(req.error);
    });

    if (!row) return undefined;
    const credential = await toCredential(row, key);

    // Upgrade legacy plaintext records to encrypted form when crypto is available.
    if (credential && key && row.password && !row.passwordCipher) {
      await saveCredential(credential.host, credential.username, credential.password);
    }

    return credential;
  } catch (e) {
    logger.warn('findCredential failed', e);
    return undefined;
  }
}

export async function deleteCredential(host: string) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(host);
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logger.warn('deleteCredential failed', e);
  }
}

// Migrate from existing localStorage key if present. This is safe to call
// multiple times; if credentials already exist in IDB we skip overwrite.
export async function migrateFromLocalStorage(localKey = 'mebooks.opds.credentials') {
  try {
    const raw = localStorage.getItem(localKey);
    if (!raw) return;
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      parsed = null;
    }
    if (!Array.isArray(parsed)) return;

    const existing = await getAllCredentials();
    const hosts = new Set(existing.map((c) => c.host));
    for (const entry of parsed) {
      if (!entry || !entry.host) continue;
      if (hosts.has(entry.host)) continue;
      await saveCredential(entry.host, entry.username, entry.password);
    }
    try {
      localStorage.removeItem(localKey);
    } catch (_error) {
      // ignore
    }
  } catch (e) {
    logger.warn('migrateFromLocalStorage failed', e);
  }
}

export default {
  saveCredential,
  getAllCredentials,
  findCredential,
  deleteCredential,
  migrateFromLocalStorage,
};
