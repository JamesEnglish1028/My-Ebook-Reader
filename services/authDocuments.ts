import type { AuthDocument, RequestAuthorization } from '../types';

import { logger } from './logger';
import { proxiedUrl } from './utils';

const authDocumentCache = new Map<string, AuthDocument>();
const patronTokenCache = new Map<string, { accessToken: string; tokenType: string; expiresAt: number }>();

function getHostFromUrl(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export function getCachedAuthDocumentForUrl(url: string): AuthDocument | null {
  const host = getHostFromUrl(url);
  if (!host) return null;
  return authDocumentCache.get(host) || null;
}

export function cacheAuthDocumentForUrl(url: string, authDocument: AuthDocument) {
  const host = getHostFromUrl(url);
  if (!host) return;
  authDocumentCache.set(host, authDocument);
}

export function getCachedPatronAuthorizationForUrl(url: string): RequestAuthorization | null {
  const host = getHostFromUrl(url);
  if (!host) return null;
  const token = patronTokenCache.get(host);
  if (!token) return null;
  if (token.expiresAt <= Date.now()) {
    patronTokenCache.delete(host);
    return null;
  }
  return {
    scheme: 'bearer',
    token: token.accessToken,
  };
}

function cachePatronTokenForUrl(
  url: string,
  token: { accessToken: string; tokenType: string; expiresIn?: number },
) {
  const host = getHostFromUrl(url);
  if (!host) return;
  patronTokenCache.set(host, {
    accessToken: token.accessToken,
    tokenType: token.tokenType,
    expiresAt: Date.now() + ((token.expiresIn || 3600) * 1000),
  });
}

export async function fetchAndCacheAuthDocument(authDocumentUrl: string, contextUrl?: string): Promise<AuthDocument | null> {
  const targetUrl = proxiedUrl(authDocumentUrl);
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.opds.authentication.v1.0+json, application/json;q=0.9, */*;q=0.5',
    },
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch authentication document: ${response.status}`);
  }

  const payload = await response.json();
  const authDocument = payload as AuthDocument;
  cacheAuthDocumentForUrl(authDocumentUrl, authDocument);
  if (contextUrl) {
    cacheAuthDocumentForUrl(contextUrl, authDocument);
  }
  logger.debug('[authDocuments] cached auth document', { authDocumentUrl, contextUrl });
  return authDocument;
}

function getBasicTokenAuthLink(authDocument: AuthDocument | null | undefined): string | null {
  const methods = Array.isArray(authDocument?.authentication) ? authDocument.authentication : [];
  for (const method of methods as any[]) {
    const type = String(method?.type || '').toLowerCase();
    if (!type.includes('basic-token')) continue;
    const links = Array.isArray(method?.links) ? method.links : [];
    const authLink = links.find((link: any) => String(link?.rel || '').toLowerCase().includes('authenticate'));
    if (authLink?.href) return String(authLink.href);
  }
  return null;
}

export async function getAuthorizationForAuthDocument(
  authDocument: AuthDocument | null | undefined,
  contextUrl: string,
  username: string,
  password: string,
): Promise<RequestAuthorization> {
  const cached = getCachedPatronAuthorizationForUrl(contextUrl);
  if (cached) return cached;

  const authenticateHref = getBasicTokenAuthLink(authDocument);
  if (!authenticateHref) {
    return {
      scheme: 'basic',
      username,
      password,
    };
  }

  const proxyUrl = proxiedUrl(authenticateHref);
  if (typeof proxyUrl === 'string' && proxyUrl.includes('corsproxy.io')) {
    throw new Error('Authentication would use a public CORS proxy which may strip Authorization headers. Configure an owned proxy (VITE_OWN_PROXY_URL).');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json, application/vnd.opds.authentication.v1.0+json, text/plain;q=0.9, */*;q=0.5',
    Authorization: `Basic ${btoa(`${username}:${password}`)}`,
  };

  let response = await fetch(proxyUrl, { method: 'POST', headers, credentials: 'omit' });
  if (response.status === 405) {
    response = await fetch(proxyUrl, { method: 'GET', headers, credentials: 'omit' });
  }

  const responseText = await response.text().catch(() => '');
  let parsed: any = null;
  try {
    parsed = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const detailMessage = typeof parsed?.detail === 'string' ? parsed.detail : null;
    if (detailMessage) throw new Error(detailMessage);
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const accessToken = typeof parsed?.accessToken === 'string' ? parsed.accessToken : null;
  const tokenType = typeof parsed?.tokenType === 'string' ? parsed.tokenType : 'Bearer';
  const expiresIn = Number(parsed?.expiresIn);

  if (!accessToken) {
    throw new Error('Authentication succeeded, but no access token was returned by the provider.');
  }

  cachePatronTokenForUrl(authenticateHref, {
    accessToken,
    tokenType,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : 3600,
  });
  cachePatronTokenForUrl(contextUrl, {
    accessToken,
    tokenType,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : 3600,
  });

  return {
    scheme: 'bearer',
    token: accessToken,
  };
}
