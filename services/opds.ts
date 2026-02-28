import type { AudienceMode, AvailabilityMode, CatalogBook, CatalogFacetGroup, CatalogFacetLink, CatalogNavigationLink, CatalogPagination, CatalogWithCategories, CatalogWithCollections, CategorizationMode, Category, Collection, CollectionGroup, CollectionMode, DistributorMode, FictionMode, MediaMode, PublicationMode } from '../types';

import { logger } from './logger';
import { parseOpds2Json } from './opds2';
import { maybeProxyForCors, proxiedUrl } from './utils';
// NOTE: prefer a static import for `maybeProxyForCors` instead of a dynamic import
// because static imports keep bundling deterministic and avoid creating a
// separate dynamic chunk for a small utility module. This prevents Vite from
// warning about a module being both statically and dynamically imported and
// simplifies chunking in production builds.

// Helper: convert a Uint8Array into a binary string (latin1) without triggering decoding
function uint8ToBinaryString(u8: Uint8Array): string {
    // Use chunking to avoid call stack / argument length issues
    const CHUNK = 0x8000;
    let result = '';
    for (let i = 0; i < u8.length; i += CHUNK) {
        const slice = u8.subarray(i, i + CHUNK);
        result += String.fromCharCode.apply(null, Array.prototype.slice.call(slice));
    }
    return result;
}

// Helper: read all bytes from a cloned response in a way that's tolerant of
// browser implementations that may throw on response.arrayBuffer(). Try
// arrayBuffer() first, then fall back to reading the stream with getReader().
// Cache response bytes so we don't attempt to read the same stream multiple times
const responseByteCache: WeakMap<any, Uint8Array> = new WeakMap();

async function readAllBytes(resp: Response): Promise<Uint8Array> {
    // Return cached bytes if already read for this response object
    try {
        const cached = responseByteCache.get(resp);
        if (cached) return cached;
    } catch (_) { }
    // Defensive read supporting test mocks (which may not implement clone()/arrayBuffer())
    try {
        // Try arrayBuffer() on the original response first. Some environments
        // implement arrayBuffer() reliably and this avoids cloning and reader
        // locking issues in some browsers/runtimes.
        if (resp && typeof resp.arrayBuffer === 'function') {
            try {
                const buf = await resp.arrayBuffer();
                const result = new Uint8Array(buf);
                try { responseByteCache.set(resp, result); } catch (_) { }
                return result;
            } catch (_) {
                // fallthrough to clone/read logic
            }
        }

        if (resp && typeof resp.clone === 'function') {
            const c = resp.clone();
            try {
                const buf = await c.arrayBuffer();
                const out = new Uint8Array(buf);
                try { responseByteCache.set(resp, out); } catch (_) { }
                return out;
            } catch (e) {
                const reader = c.body && (c.body as any).getReader ? (c.body as any).getReader() : null;
                if (!reader) throw e;
                const chunks: Uint8Array[] = [];
                let total = 0;
                while (true) {

                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value) {
                        const u8 = value instanceof Uint8Array ? value : new Uint8Array(value);
                        chunks.push(u8);
                        total += u8.length;
                    }
                }
                const out = new Uint8Array(total);
                let offset = 0;
                for (const chunk of chunks) {
                    out.set(chunk, offset);
                    offset += chunk.length;
                }
                try { responseByteCache.set(resp, out); } catch (_) { }
                return out;
            }
        }

        if (resp && typeof resp.text === 'function') {
            const txt = await resp.text();
            let encoded: Uint8Array;
            if (typeof TextEncoder !== 'undefined') encoded = new TextEncoder().encode(txt);
            else if (typeof Buffer !== 'undefined') encoded = new Uint8Array(Buffer.from(txt, 'utf-8'));
            else encoded = new Uint8Array();
            try { responseByteCache.set(resp, encoded); } catch (_) { }
            return encoded;
        }

        if (resp && resp.body) {
            if (resp.body instanceof Uint8Array) {
                try { responseByteCache.set(resp, resp.body); } catch (_) { }
                return resp.body;
            }
            // @ts-ignore
            if (typeof Buffer !== 'undefined' && Buffer.isBuffer(resp.body)) {
                const out = new Uint8Array(resp.body);
                try { responseByteCache.set(resp, out); } catch (_) { }
                return out;
            }
        }

        return new Uint8Array();
    } catch (e) {
        throw e;
    }
}

// Helper: read response body as text but gracefully handle decoding errors
async function safeReadText(resp: Response): Promise<string> {
    try {
        const u8 = await readAllBytes(resp);
        try {
            return new TextDecoder('utf-8', { fatal: false }).decode(u8);
        } catch (e) {
            try { return new TextDecoder('iso-8859-1', { fatal: false }).decode(u8); } catch (e2) { return uint8ToBinaryString(u8); }
        }
    } catch (e) {
        console.warn('safeReadText: fallback decode failed', e);
        try {
            if (resp && typeof resp.text === 'function') return await resp.text();
        } catch (_) { }
        return '';
    }
}

// Helper to capture the first N bytes of a response for debugging (base64)
async function captureFirstBytes(resp: Response, maxBytes = 512): Promise<string> {
    try {
        const u8 = await readAllBytes(resp);
        const slice = u8.subarray(0, Math.min(u8.length, maxBytes));
        const binary = uint8ToBinaryString(slice);
        return btoa(binary);
    } catch (e) {
        console.warn('captureFirstBytes failed', e);
        return '';
    }
}

export const getFormatFromMimeType = (mimeType: string | undefined): string | undefined => {
    if (!mimeType) return undefined;
    // Remove any parameters following a semicolon (e.g. "application/atom+xml;type=entry;profile=opds-catalog")
    const clean = mimeType.split(';')[0].trim().toLowerCase();
    if (clean.includes('epub') || clean === 'application/epub+zip') return 'EPUB';
    if (clean.includes('pdf') || clean === 'application/pdf') return 'PDF';
    if (clean.includes('audiobook') || clean === 'http://bib.schema.org/audiobook') return 'AUDIOBOOK';
    // For ambiguous/non-media types (atom, opds catalog entries, etc.) return undefined so UI doesn't show raw mime strings
    return undefined;
};

const getResolvedIndirectMediaType = (element: Element | null): string | undefined => {
    if (!element) return undefined;

    const children = Array.from(element.children);

    for (const child of children) {
        const local = (child.localName || child.nodeName || '').toLowerCase();
        if (local !== 'indirectacquisition') continue;

        const nestedResolved = getResolvedIndirectMediaType(child);
        if (nestedResolved) return nestedResolved;

        const childType = child.getAttribute('type') || undefined;
        if (getFormatFromMimeType(childType)) return childType;
    }

    for (const child of children) {
        const nestedResolved = getResolvedIndirectMediaType(child);
        if (nestedResolved) return nestedResolved;
    }

    return undefined;
};

const getDirectChildText = (parent: Element, localName: string): string | undefined => {
    const child = Array.from(parent.children).find((node) => (node.localName || node.nodeName || '').toLowerCase() === localName.toLowerCase());
    const text = child?.textContent?.trim();
    return text || undefined;
};

const mergeCollections = (existing?: Collection[], next?: Collection[]): Collection[] | undefined => {
    const merged = new Map<string, Collection>();

    (existing || []).forEach((collection) => {
        merged.set(collection.href, collection);
    });

    (next || []).forEach((collection) => {
        merged.set(collection.href, collection);
    });

    return merged.size > 0 ? Array.from(merged.values()) : undefined;
};

const mergeCategories = (existing?: Category[], next?: Category[]): Category[] | undefined => {
    const merged = new Map<string, Category>();

    (existing || []).forEach((category) => {
        merged.set(`${category.scheme}|${category.term}|${category.label}`, category);
    });

    (next || []).forEach((category) => {
        merged.set(`${category.scheme}|${category.term}|${category.label}`, category);
    });

    return merged.size > 0 ? Array.from(merged.values()) : undefined;
};

const mergeStrings = (existing?: string[], next?: string[]): string[] | undefined => {
    const merged = Array.from(new Set([...(existing || []), ...(next || [])].filter(Boolean)));
    return merged.length > 0 ? merged : undefined;
};

const mergeCatalogBooks = (existing: CatalogBook, incoming: CatalogBook): CatalogBook => ({
    ...existing,
    author: existing.author || incoming.author,
    coverImage: existing.coverImage || incoming.coverImage,
    downloadUrl: existing.downloadUrl || incoming.downloadUrl,
    summary: existing.summary || incoming.summary,
    publisher: existing.publisher || incoming.publisher,
    publicationDate: existing.publicationDate || incoming.publicationDate,
    providerId: existing.providerId || incoming.providerId,
    distributor: existing.distributor || incoming.distributor,
    subjects: mergeStrings(existing.subjects, incoming.subjects),
    categories: mergeCategories(existing.categories, incoming.categories),
    format: existing.format || incoming.format,
    acquisitionMediaType: existing.acquisitionMediaType || incoming.acquisitionMediaType,
    collections: mergeCollections(existing.collections, incoming.collections),
    isOpenAccess: existing.isOpenAccess || incoming.isOpenAccess || undefined,
    availabilityStatus: existing.availabilityStatus || incoming.availabilityStatus,
    schemaOrgType: existing.schemaOrgType || incoming.schemaOrgType,
    publicationTypeLabel: existing.publicationTypeLabel || incoming.publicationTypeLabel,
    mediumFormatCode: existing.mediumFormatCode || incoming.mediumFormatCode,
});

const getNestedAvailabilityStatus = (element: Element | null): string | undefined => {
    if (!element) return undefined;

    for (const child of Array.from(element.children)) {
        const local = (child.localName || child.nodeName || '').toLowerCase();
        if (local === 'availability') {
            return child.getAttribute('status') || undefined;
        }
        const nested = getNestedAvailabilityStatus(child);
        if (nested) return nested;
    }

    return undefined;
};

const isPalaceHost = (url: string): boolean => {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return hostname.endsWith('palace.io')
            || hostname.endsWith('palaceproject.io')
            || hostname.endsWith('thepalaceproject.org')
            || hostname === 'palace.io'
            || hostname.endsWith('.palace.io')
            || hostname.endsWith('.thepalaceproject.org');
    } catch {
        return false;
    }
};

/**
 * Parses OPDS 1 XML feeds into a standardized format.
 * Handles audiobook detection via schema:additionalType attributes.
 * Supports Palace Project collection links and indirect acquisition chains.
 */
export const parseOpds1Xml = (xmlText: string, baseUrl: string): { books: CatalogBook[], navLinks: CatalogNavigationLink[], facetGroups: CatalogFacetGroup[], pagination: CatalogPagination } => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

    const errorNode = xmlDoc.querySelector('parsererror');
    if (errorNode) {
        console.error('XML Parsing Error:', errorNode.textContent);
        throw new Error('Failed to parse catalog feed. The URL may not point to a valid OPDS feed, or the response was not valid XML.');
    }

    // Add check for the root <feed> element to validate it's an Atom feed.
    const rootNodeName = xmlDoc.documentElement?.nodeName;
    if (!rootNodeName || (rootNodeName.toLowerCase() !== 'feed' && !rootNodeName.endsWith(':feed'))) {
        throw new Error('Invalid Atom/OPDS feed. The XML document is missing the root <feed> element.');
    }

    const entries = Array.from(xmlDoc.querySelectorAll('entry'));
    const books: CatalogBook[] = [];
    const navLinks: CatalogNavigationLink[] = [];
    const facetGroups: CatalogFacetGroup[] = [];
    const pagination: CatalogPagination = {};
    const navLinkKeys = new Set<string>();
    const bookIndexes = new Map<string, number>();
    const palaceFeed = isPalaceHost(baseUrl);

    const addNavLink = (link: CatalogNavigationLink) => {
        const key = `${link.rel}|${link.url}`;
        if (navLinkKeys.has(key)) return;
        navLinkKeys.add(key);
        navLinks.push(link);
    };

    const addOrMergeBook = (book: CatalogBook) => {
        const key = book.providerId || book.downloadUrl;
        if (!key) {
            books.push(book);
            return;
        }

        const existingIndex = bookIndexes.get(key);
        if (typeof existingIndex === 'number') {
            books[existingIndex] = mergeCatalogBooks(books[existingIndex], book);
            return;
        }

        bookIndexes.set(key, books.length);
        books.push(book);
    };

    // Extract pagination links from feed-level link elements
    const feedLinks = Array.from(xmlDoc.querySelectorAll('feed > link'));
    feedLinks.forEach(link => {
        const relRaw = link.getAttribute('rel') || '';
        const rel = String(relRaw).toLowerCase();
        const href = link.getAttribute('href');
        if (href) {
            const fullUrl = new URL(href, baseUrl).href;
            // Be tolerant of rel variants and full URIs (e.g. rel="prev" or rel="http://opds-spec.org/rel/previous")
            if (rel.includes('next')) pagination.next = fullUrl;
            if (rel.includes('prev') || rel.includes('previous')) pagination.prev = fullUrl;
            if (rel.includes('first')) pagination.first = fullUrl;
            if (rel.includes('last')) pagination.last = fullUrl;
            if (rel.includes('facet')) {
                const title = link.getAttribute('title')?.trim();
                if (!title) return;
                const groupTitle = link.getAttribute('opds:facetGroup')
                    || link.getAttribute('facetGroup')
                    || 'Facets';
                const activeFacetRaw = link.getAttribute('opds:activeFacet') || link.getAttribute('activeFacet') || '';
                const countRaw = link.getAttribute('thr:count') || link.getAttribute('count') || '';
                const count = Number(countRaw);
                const facetLink: CatalogFacetLink = {
                    title,
                    url: fullUrl,
                    type: link.getAttribute('type') || undefined,
                    rel: relRaw || undefined,
                    count: Number.isFinite(count) ? count : undefined,
                    isActive: activeFacetRaw === 'true' || activeFacetRaw === 'active',
                };
                const existingGroup = facetGroups.find(group => group.title === groupTitle);
                if (existingGroup) {
                    existingGroup.links.push(facetLink);
                } else {
                    facetGroups.push({ title: groupTitle, links: [facetLink] });
                }
                return;
            }

            if (rel === 'collection' || rel.includes('subsection')) {
                addNavLink({
                    title: link.getAttribute('title')?.trim() || fullUrl,
                    url: fullUrl,
                    rel: relRaw || 'collection',
                    type: link.getAttribute('type') || undefined,
                    source: 'navigation',
                });
            }
        }
    });

    entries.forEach(entry => {
        const title = entry.querySelector('title')?.textContent?.trim() || 'Untitled';
        const allLinks = Array.from(entry.querySelectorAll('link'));

        // Check for schema:additionalType to detect audiobooks
        const schemaType = entry.getAttribute('schema:additionalType');
        const isAudiobook = schemaType === 'http://bib.schema.org/Audiobook' || schemaType === 'http://schema.org/Audiobook';

        // Find acquisition links for downloadable books
        const openAccessLink = allLinks.find(link => {
            const rel = link.getAttribute('rel') || '';
            return rel.includes('/open-access') || rel === 'http://opds-spec.org/acquisition/open-access';
        });
        const acquisitionLink = openAccessLink || allLinks.find(link => {
            const rel = link.getAttribute('rel') || '';
            const type = link.getAttribute('type') || '';
            return rel.includes('opds-spec.org/acquisition') && (type.includes('epub+zip') || type.includes('pdf'));
        }) || allLinks.find(link => (link.getAttribute('rel') || '').includes('opds-spec.org/acquisition'));
        const isOpenAccess = !!openAccessLink;

        let distributor: string | undefined = undefined;
        try {
            const distributionElements = entry.getElementsByTagName('bibframe:distribution');
            if (distributionElements.length > 0) {
                const distributorRaw = distributionElements[0].getAttribute('bibframe:ProviderName')?.trim();
                distributor = distributorRaw && distributorRaw.length > 0 ? distributorRaw : undefined;
            }
        } catch (error) {
            try {
                const distributionElements = entry.getElementsByTagName('distribution');
                if (distributionElements.length > 0) {
                    const distributorRaw = distributionElements[0].getAttribute('ProviderName')?.trim();
                    distributor = distributorRaw && distributorRaw.length > 0 ? distributorRaw : undefined;
                }
            } catch (fallbackError) {
                console.warn('Could not parse distributor information:', fallbackError);
            }
        }

        const collectionLinks = Array.from(entry.querySelectorAll('link[rel="collection"]'));
        const collections = collectionLinks.map(link => {
            const href = link.getAttribute('href');
            const title = link.getAttribute('title');
            if (href && title) {
                const fullUrl = new URL(href, baseUrl).href;
                const normalizedTitle = title.trim();
                const isDistributorMirror = palaceFeed && distributor
                    && normalizedTitle.toLowerCase() === distributor.toLowerCase();
                if (!isDistributorMirror) {
                    addNavLink({
                        title: normalizedTitle,
                        url: fullUrl,
                        rel: 'collection',
                        type: link.getAttribute('type') || undefined,
                        source: 'navigation',
                    });
                }
                return {
                    title: normalizedTitle,
                    href: fullUrl,
                };
            }
            return null;
        }).filter((collection): collection is { title: string; href: string } => collection !== null);
        const subsectionLink = entry.querySelector('link[rel="subsection"], link[rel="http://opds-spec.org/subsection"]');
        const collectionNavLink = collectionLinks.find((link) => {
            const title = link.getAttribute('title')?.trim();
            if (!title) return false;
            return !(palaceFeed && distributor && title.toLowerCase() === distributor.toLowerCase());
        }) || null;
        const kindNavigationLink = allLinks.find((link) => {
            const rel = (link.getAttribute('rel') || '').toLowerCase();
            const type = (link.getAttribute('type') || '').toLowerCase();
            if (rel.includes('opds-spec.org/acquisition')) return false;
            return type.includes('profile=opds-catalog') && type.includes('kind=navigation');
        }) || null;
        const kindAcquisitionCatalogLink = allLinks.find((link) => {
            const rel = (link.getAttribute('rel') || '').toLowerCase();
            const type = (link.getAttribute('type') || '').toLowerCase();
            if (rel.includes('opds-spec.org/acquisition')) return false;
            return type.includes('profile=opds-catalog') && type.includes('kind=acquisition');
        }) || null;


        if (acquisitionLink) {
            // ...existing book parsing logic...
            const author = entry.querySelector('author > name')?.textContent?.trim() || 'Unknown Author';
            const summary = entry.querySelector('summary')?.textContent?.trim() || entry.querySelector('content')?.textContent?.trim() || null;
            const coverLink = entry.querySelector('link[rel="http://opds-spec.org/image"]');
            const coverImageHref = coverLink?.getAttribute('href');
            const coverImage = coverImageHref ? new URL(coverImageHref, baseUrl).href : null;
            const downloadUrlHref = acquisitionLink?.getAttribute('href');
            const mimeType = acquisitionLink?.getAttribute('type') || '';
            const resolvedIndirectMediaType = getResolvedIndirectMediaType(acquisitionLink as Element);
            const resolvedMediaType = getFormatFromMimeType(mimeType) ? mimeType : resolvedIndirectMediaType;
            let format = getFormatFromMimeType(resolvedMediaType || mimeType);
            if (isAudiobook) {
                format = 'AUDIOBOOK';
            }
            const availabilityStatus = getNestedAvailabilityStatus(acquisitionLink as Element);
            const publisher = (entry.querySelector('publisher')?.textContent || entry.querySelector('dc\\:publisher')?.textContent)?.trim();
            const publicationDate = (entry.querySelector('issued')?.textContent || entry.querySelector('dc\\:issued')?.textContent || entry.querySelector('published')?.textContent)?.trim();
            const providerId = getDirectChildText(entry, 'identifier') || getDirectChildText(entry, 'id');
            const categories = Array.from(entry.querySelectorAll('category')).map(cat => {
                const scheme = cat.getAttribute('scheme') || 'http://palace.io/subjects';
                const term = cat.getAttribute('term')?.trim();
                const label = cat.getAttribute('label')?.trim();
                if (term) {
                    return {
                        scheme,
                        term,
                        label: label || term,
                    };
                }
                return null;
            }).filter((category): category is Category => category !== null);
            const subjects = categories.map(cat => cat.label);
            if (downloadUrlHref) {
                const downloadUrl = new URL(downloadUrlHref, baseUrl).href;
                let finalMediaType = resolvedMediaType || mimeType;
                if (!finalMediaType && isAudiobook) {
                    finalMediaType = 'http://bib.schema.org/Audiobook';
                }
                addOrMergeBook({
                    title,
                    author,
                    coverImage,
                    downloadUrl,
                    summary,
                    publisher: publisher || undefined,
                    publicationDate: publicationDate || undefined,
                    providerId,
                    distributor: distributor,
                    subjects: subjects.length > 0 ? subjects : undefined,
                    categories: categories.length > 0 ? categories : undefined,
                    format,
                    acquisitionMediaType: finalMediaType || undefined,
                    collections: collections.length > 0 ? collections : undefined,
                    isOpenAccess: isOpenAccess || undefined,
                    availabilityStatus: availabilityStatus || undefined,
                });
            }
        } else if (subsectionLink || collectionNavLink || kindNavigationLink || kindAcquisitionCatalogLink) {
            const navSource = subsectionLink || collectionNavLink || kindNavigationLink || kindAcquisitionCatalogLink;
            const navUrl = navSource?.getAttribute('href');
            if (navUrl) {
                addNavLink({
                    title,
                    url: new URL(navUrl, baseUrl).href,
                    rel: subsectionLink
                        ? 'subsection'
                        : collectionNavLink
                            ? 'collection'
                            : kindAcquisitionCatalogLink && navSource === kindAcquisitionCatalogLink
                                ? 'acquisition'
                                : 'navigation',
                    type: navSource?.getAttribute('type') || undefined,
                    source: 'navigation',
                });
            }
        }
    });

    // If <feed> has no <entry> elements (empty feed), decide whether to
    // throw or return empty results. Some callers/tests expect an empty
    // result for feeds that include only descriptive metadata (e.g. a
    // <title>), while truly empty feeds with no child elements should be
    // treated as errors. Check for presence of common feed-level elements
    // such as <title> or <link> before deciding.
    if (rootNodeName && (rootNodeName.toLowerCase() === 'feed' || rootNodeName.endsWith(':feed')) && entries.length === 0) {
        // Use namespace-agnostic DOM methods to check for feed-level content.
        const feedEl = xmlDoc.documentElement;
        const hasTitle = !!(feedEl && feedEl.getElementsByTagName('title') && feedEl.getElementsByTagName('title').length > 0);
        const hasLink = !!(feedEl && feedEl.getElementsByTagName('link') && feedEl.getElementsByTagName('link').length > 0);
        if (!hasTitle && !hasLink) {
            throw new Error('The feed contains no entries.');
        }
        return { books: [], navLinks: [], facetGroups, pagination };
    }
    // Throw if <feed> has entries but no OPDS content
    if (rootNodeName && (rootNodeName.toLowerCase() === 'feed' || rootNodeName.endsWith(':feed')) && entries.length > 0 && books.length === 0 && navLinks.length === 0) {
        throw new Error('This appears to be a valid Atom feed, but it contains no recognizable OPDS book entries or navigation links. Please ensure the URL points to an OPDS catalog.');
    }

    return { books, navLinks, facetGroups, pagination };
};

const getProxy403Message = (url: string, headers: Headers, contentType: string, responseText: string): string => {
    const errorSource = headers.get('x-mebooks-proxy-error-source');
    if (errorSource === 'upstream') {
        const upstreamStatus = headers.get('x-mebooks-upstream-status') || '403';
        return `The proxy reached the upstream server, but the upstream server denied the request (${upstreamStatus}) for ${url}. This is not a proxy allowlist rejection.`;
    }

    if (contentType.includes('application/json')) {
        try {
            const parsed = JSON.parse(responseText);
            if (parsed && parsed.error && typeof parsed.error === 'string') {
                const blockedHost = typeof parsed.host === 'string' ? parsed.host : '';
                const blockedProtocol = typeof parsed.protocol === 'string' ? parsed.protocol : '';
                if (parsed.error.toLowerCase().includes('host')) {
                    const targetLabel = blockedHost || url;
                    const protocolHint = blockedProtocol === 'http:'
                        ? ' This upstream is plain HTTP, so the proxy must explicitly allow that host and serve the browser over HTTPS.'
                        : '';
                    return `Proxy denied access to host for ${targetLabel}. The proxy's HOST_ALLOWLIST may need to include the upstream host.${protocolHint}`;
                }
                if (errorSource === 'proxy') return `Proxy error: ${parsed.error}`;
            }
        } catch (e) {
            // Fall through to the generic message if the proxy body is not valid JSON.
        }
    }

    if (errorSource === 'proxy') {
        return `The proxy itself denied the request for ${url}. Check proxy configuration and allowlist rules.`;
    }

    return `Proxy returned 403 for ${url}. The proxy may be blocking this host.`;
};


export const fetchCatalogContent = async (url: string, baseUrl: string, forcedVersion: 'auto' | '1' | '2' = 'auto'): Promise<{ books: CatalogBook[], navLinks: CatalogNavigationLink[], facetGroups: CatalogFacetGroup[], pagination: CatalogPagination, error?: string }> => {
    try {
        // Resolve relative links against the actual feed URL, not the catalog root.
        // For direct fetches that follow redirects, prefer the final response URL.
        let parseBaseUrl = url;
        // Some providers (notably Palace Project / palace.io, palaceproject.io, and thepalaceproject.org hosts) operate
        // primarily for native clients and don't expose CORS consistently. For
        // those hosts we should force requests through our owned proxy so the
        // browser won't be blocked. Detect palace-like hosts and skip the probe.
        const hostname = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();
        const isPalaceHost = hostname.endsWith('palace.io') || hostname.endsWith('palaceproject.io') || hostname.endsWith('thepalaceproject.org') || hostname === 'palace.io' || hostname.endsWith('.palace.io') || hostname.endsWith('.thepalaceproject.org');

        // Log host classification to confirm palace hosts are being forced through owned proxy
        logger.debug('fetchCatalogContent host classification', { hostname, isPalaceHost, forcedVersion });

        let fetchUrl: string;
        if (isPalaceHost) {
            // Force owned proxy for palace hosts to ensure acquisition links and
            // embedded XML are reachable from the browser (via our server-side proxy).
            fetchUrl = proxiedUrl(url);
        } else {
            // Try direct fetch first (CORS-capable). maybeProxyForCors will probe the URL
            // and return either the original URL (if direct fetch should work) or a proxied URL.
            fetchUrl = await maybeProxyForCors(url);
        }
        // Choose Accept header based on forcedVersion so servers return the expected format
        // For Palace-hosted servers we strongly prefer XML/Atom and avoid JSON to get collection navigation links
        const acceptHeader = isPalaceHost || forcedVersion === '1'
            ? 'application/atom+xml;profile=opds-catalog, application/xml, text/xml, */*'
            : 'application/opds+json, application/atom+xml;profile=opds-catalog;q=0.9, application/json;q=0.8, application/xml;q=0.7, */*;q=0.5';

        // FIX: Added specific Accept header to signal preference for OPDS formats.
        // Log fetch URL to show whether proxied or direct URL is used
        logger.debug('fetchCatalogContent fetch details', { fetchUrl, acceptHeader });
        // Determine whether this is a direct fetch (so we can include credentials)
        const isDirectFetch = fetchUrl === url;
        const response = await fetch(fetchUrl, {
            method: 'GET',
            mode: 'cors',
            credentials: isDirectFetch ? 'include' : 'omit',
            headers: {
                'Accept': acceptHeader,
            },
        });

        // Diagnostic: log the initial response status and Content-Type as observed
        // by the browser. This helps identify whether the response the app sees
        // is JSON, XML, or missing headers.
        try {
            // eslint-disable-next-line no-console
            console.debug('[mebooks] initial response - status:', response.status, 'content-type:', response.headers.get('Content-Type'));
        } catch (e) { /* ignore logging failures */ }

        // If the direct fetch returned a redirect (3xx) or the response lacks CORS
        // headers when we attempted a direct fetch, the browser will block reading
        // the body. In that case, retry the request via the configured proxy.
        const isRedirect = response.status >= 300 && response.status < 400;
        const hasCorsHeader = !!response.headers.get('Access-Control-Allow-Origin');
        if ((isRedirect || (isDirectFetch && !hasCorsHeader)) && proxiedUrl) {
            const proxyFetchUrl = proxiedUrl(url);
            const proxiedResp = await fetch(proxyFetchUrl, {
                method: 'GET',
                headers: {
                    'Accept': acceptHeader,
                },
            });
            // Replace response with proxied response for parsing below
            if (proxiedResp) {
                // Note: we can't reassign the const `response`, so read proxiedResp into locals used below
                const contentType = proxiedResp.headers.get('Content-Type') || '';
                const responseText = await safeReadText(proxiedResp);

                // Detect proxy-level rejections (common when HOST_ALLOWLIST blocks the target)
                if (proxiedResp.status === 403) {
                    throw new Error(getProxy403Message(url, proxiedResp.headers, contentType, responseText));
                }

                if (contentType.includes('text/html') && responseText.trim().toLowerCase().startsWith('<!doctype html>')) {
                    throw new Error('The CORS proxy returned an HTML page instead of the catalog feed. This might indicate the proxy service is down or blocking the request. Please try another catalog or check back later.');
                }

                // If caller requested a forced version, prefer that parsing path even if Content-Type
                // suggests otherwise. Log the decision for diagnostics.
                // eslint-disable-next-line no-console
                console.debug('[mebooks] proxied response - forcedVersion:', forcedVersion, 'contentType:', contentType, 'url:', url);
                if (forcedVersion === '1' && responseText.trim().startsWith('<')) {
                    // eslint-disable-next-line no-console
                    console.debug('[mebooks] Forcing OPDS1 (XML) parse for proxied response');
                    return parseOpds1Xml(responseText, parseBaseUrl);
                }

                // Enhanced logic to handle ambiguous Content-Type headers
                if (contentType.includes('application/opds+json') || contentType.includes('application/json')) {
                    try {
                        console.warn('[mebooks] Attempting to parse OPDS2 JSON (proxied), response length:', responseText.length);
                        const jsonData = JSON.parse(responseText);
                        console.warn('[mebooks] Successfully parsed OPDS2 JSON (proxied), keys:', Object.keys(jsonData).slice(0, 5));
                        return parseOpds2Json(jsonData, parseBaseUrl);
                    } catch (e) {
                        // If parsing fails, check if the body looks like XML
                        if (responseText && responseText.trim().startsWith('<')) {
                            try {
                                console.warn('[mebooks] Response body appears to be XML despite JSON Content-Type; attempting XML parse');
                                return parseOpds1Xml(responseText, parseBaseUrl);
                            } catch (xmlErr) {
                                console.error('[mebooks] Failed to parse as XML after JSON Content-Type:', xmlErr);
                                throw new Error('Failed to parse catalog content as both JSON and XML.');
                            }
                        } else {
                            console.error('[mebooks] Failed to parse as JSON (proxied) and does not appear to be XML:', e);
                            throw new Error('Failed to parse catalog content as JSON.');
                        }
                    }
                } else if (contentType.includes('application/atom+xml') || contentType.includes('application/xml') || contentType.includes('text/xml') || responseText.trim().startsWith('<')) {
                    try {
                        return parseOpds1Xml(responseText, parseBaseUrl);
                    } catch (xmlErr) {
                        console.error('[mebooks] Failed to parse as XML:', xmlErr);
                        throw new Error('Failed to parse catalog content as XML.');
                    }
                } else {
                    console.error('[mebooks] Unsupported Content-Type or ambiguous response:', contentType);
                    throw new Error(`Unsupported or ambiguous catalog format. Content-Type: "${contentType}"`);
                }
            }
        }

        if (!response.ok) {
            const statusInfo = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
            let errorMessage = `The catalog server responded with an error (${statusInfo}). Please check the catalog URL.`;
            if (response.status === 401 || (response.status === 403 && isDirectFetch)) {
                errorMessage = `Could not access catalog (${statusInfo}). This catalog requires authentication (a login or password), which is not supported by this application.`;
            }
            if (response.status === 403 && !isDirectFetch) {
                const contentType = response.headers.get('Content-Type') || '';
                const responseText = await safeReadText(response).catch(() => '');
                errorMessage = getProxy403Message(url, response.headers, contentType, responseText);
            }
            if (response.status === 429) {
                errorMessage = `Could not access catalog (${statusInfo}). The request was rate-limited by the server or the proxy. Please wait a moment and try again.`;
            }
            throw new Error(errorMessage);
        }

        const contentType = response.headers.get('Content-Type') || '';
        const responseText = await safeReadText(response);
        if (isDirectFetch && response.url) {
            parseBaseUrl = response.url;
        }

        // FIX: Add specific check for HTML response from a faulty proxy
        if (contentType.includes('text/html') && responseText.trim().toLowerCase().startsWith('<!doctype html>')) {
            throw new Error('The CORS proxy returned an HTML page instead of the catalog feed. This might indicate the proxy service is down or blocking the request. Please try another catalog or check back later.');
        }

        // Respect forcedVersion preference for responses read from the direct fetch path.
        // Diagnostic: log forcedVersion and content type for the direct response path
        // eslint-disable-next-line no-console
        console.debug('[mebooks] direct response - forcedVersion:', forcedVersion, 'contentType:', contentType, 'url:', url);
        if (forcedVersion === '1' && responseText.trim().startsWith('<')) {
            // eslint-disable-next-line no-console
            console.debug('[mebooks] Forcing OPDS1 (XML) parse for direct response');
            return parseOpds1Xml(responseText, parseBaseUrl);
        }

        console.warn('[mebooks] About to check JSON condition - forcedVersion:', forcedVersion, 'contentType includes opds+json:', contentType.includes('application/opds+json'));
        // Enhanced logic to handle ambiguous Content-Type headers
        if (contentType.includes('application/opds+json') || contentType.includes('application/json')) {
            try {
                console.warn('[mebooks] Attempting to parse OPDS2 JSON (direct), response length:', responseText.length);
                const jsonData = JSON.parse(responseText);
                console.warn('[mebooks] Successfully parsed OPDS2 JSON (direct), keys:', Object.keys(jsonData).slice(0, 5));
                return parseOpds2Json(jsonData, parseBaseUrl);
            } catch (e) {
                // Some Palace endpoints return Atom XML but incorrectly set Content-Type
                // to application/json; if the body looks like XML, try parsing as XML.
                if (responseText && responseText.trim().startsWith('<')) {
                    try {
                        console.warn('[mebooks] Direct response body appears to be XML despite JSON Content-Type; attempting XML parse');
                        return parseOpds1Xml(responseText, parseBaseUrl);
                    } catch (xmlErr) {
                        console.error('[mebooks] Failed to parse as XML after JSON Content-Type:', xmlErr);
                        throw new Error('Failed to parse catalog content as both JSON and XML.');
                    }
                }
                console.warn('[mebooks] Failed to JSON.parse response (direct)');
                throw new Error(`Failed to parse JSON response for ${url}.`);
            }
        } else if (contentType.includes('application/atom+xml') || contentType.includes('application/xml') || contentType.includes('text/xml')) {
            return parseOpds1Xml(responseText, parseBaseUrl);
        } else {
            // Attempt to auto-detect format if Content-Type is vague (e.g., text/plain)
            console.warn('[mebooks] Fell through to else block - forcedVersion:', forcedVersion, 'contentType:', contentType, 'response starts with {:', responseText.trim().startsWith('{'), 'response starts with <:', responseText.trim().startsWith('<'));
            if (forcedVersion !== '1' && responseText.trim().startsWith('{')) {
                try {
                    const jsonData = JSON.parse(responseText);
                    return parseOpds2Json(jsonData, parseBaseUrl);
                } catch (e) { /* Fall through to XML parsing */ }
            }
            if (responseText.trim().startsWith('<')) {
                return parseOpds1Xml(responseText, parseBaseUrl);
            }
            throw new Error(`Unsupported or ambiguous catalog format. Content-Type: "${contentType}".`);
        }
    } catch (error) {
        console.error('Error fetching or parsing catalog content:', error);
        let message: string;

        if (error instanceof TypeError) {
            if (error.message.includes('exceeds response Body')) {
                message = 'A network error occurred while downloading the catalog. The response was incomplete, which can be caused by an unstable connection or a proxy issue. Please try again.';
            } else if (error.message === 'Failed to fetch') {
                message = 'Network Error: Failed to fetch the content. This could be due to your internet connection, the remote catalog being offline, or the public CORS proxy being temporarily unavailable.';
            } else {
                message = `A network error occurred: ${error.message}`;
            }
        } else if (error instanceof SyntaxError) {
            message = 'Failed to parse the catalog feed. The response was not valid JSON or XML.';
        } else if (error instanceof Error) {
            message = error.message; // Fallback for other generic errors
        } else {
            message = 'An unknown error occurred while loading the catalog.';
        }

        return { books: [], navLinks: [], facetGroups: [], pagination: {}, error: message };
    }
};

// OPDS1 acquisition resolver: POST/GET to borrow endpoints and parse XML
export const resolveAcquisitionChainOpds1 = async (href: string, credentials?: { username: string; password: string } | null, maxRedirects = 5): Promise<string | null> => {
    let attempts = 0;
    // Known Palace-related media types that some feeds use for indirect acquisition
    const palaceTypes = ['application/adobe+epub', 'application/pdf+lcp', 'application/vnd.readium.license.status.v1.0+json'];
    // Keep the original href as the canonical base for resolving relative
    // links returned by the server. We may fetch via a proxied URL (current)
    // but any relative hrefs in responses should be resolved against the
    // original upstream href, not the proxy URL.
    const originalHref = href;
    // For Palace Project servers (palace.io, palaceproject.io, thepalaceproject.org), force the proxied URL (prefer owned proxy when configured)
    let current: string;
    try {
        const hostname = (() => { try { return new URL(href).hostname.toLowerCase(); } catch { return ''; } })();
        const isPalaceHost = hostname.endsWith('palace.io') || hostname.endsWith('palaceproject.io') || hostname.endsWith('thepalaceproject.org') || hostname === 'palace.io' || hostname.endsWith('.palace.io') || hostname.endsWith('.thepalaceproject.org');
        if (isPalaceHost) {
            current = proxiedUrl(href);
        } else {
            current = await maybeProxyForCors(href);
        }
    } catch (e) {
        current = await maybeProxyForCors(href);
    }
    // If the probe selected the public proxy and credentials are provided,
    // fail early with a helpful message so UI can prompt for setting an owned proxy.
    try {
        const usingPublicProxy = typeof current === 'string' && current.includes('corsproxy.io');
        if (usingPublicProxy && credentials) {
            const err: any = new Error('Acquisition would use a public CORS proxy which may strip Authorization or block POST requests. Configure an owned proxy (VITE_OWN_PROXY_URL) to perform authenticated borrows.');
            err.proxyUsed = true;
            throw err;
        }
    } catch (e) {
        throw e;
    }

    const makeHeaders = (withCreds = false) => {
        const h: Record<string, string> = { 'Accept': 'application/atom+xml, application/xml, text/xml, */*' };
        if (withCreds && credentials) h['Authorization'] = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
        return h;
    };

    const preferGetWhenCreds = !!credentials;

    while (attempts < maxRedirects && current) {
        attempts++;
        let resp: Response | null = null;
        try {
            // Include cookies for direct (non-proxied) fetches so provider-set
            // session cookies are sent. Omit credentials for proxied requests.
            const directFetch = typeof current === 'string' && current === originalHref;
            if (preferGetWhenCreds) {
                resp = await fetch(current, { method: 'GET', headers: makeHeaders(true), credentials: directFetch ? 'include' : 'omit' });
                if (resp.status === 405) resp = await fetch(current, { method: 'POST', headers: makeHeaders(true), credentials: directFetch ? 'include' : 'omit' });
            } else {
                resp = await fetch(current, { method: 'POST', headers: makeHeaders(false), credentials: directFetch ? 'include' : 'omit' });
                if (resp.status === 405) resp = await fetch(current, { method: 'GET', headers: makeHeaders(false), credentials: directFetch ? 'include' : 'omit' });
            }
        } catch (e) {
            throw e;
        }

        if (!resp) return null;

        // Follow redirects via Location
        if (resp.status >= 300 && resp.status < 400) {
            const loc = (resp.headers && typeof resp.headers.get === 'function') ? (resp.headers.get('Location') || resp.headers.get('location')) : null;
            if (loc) return new URL(loc, originalHref).href;
        }

        const ok = typeof resp.ok === 'boolean' ? resp.ok : (resp.status >= 200 && resp.status < 300);

        if (ok) {
            const text = await safeReadText(resp).catch(() => '');
            // Parse XML for <link> elements that indicate acquisition/content
            try {
                if (text.trim().startsWith('<')) {
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(text, 'application/xml');
                    const links = Array.from(xml.querySelectorAll('link')) as Element[];
                    // prefer explicit acquisition links with known media types
                    const palaceTypes = ['application/adobe+epub', 'application/pdf+lcp', 'application/vnd.readium.license.status.v1.0+json'];
                    const candidate = links.find(l => {
                        const rel = (l.getAttribute('rel') || '').toLowerCase();
                        const type = (l.getAttribute('type') || '').toLowerCase();
                        const hrefAttr = l.getAttribute('href');
                        if (!hrefAttr) return false;
                        if (rel.includes('acquisition') || rel.includes('borrow') || rel.includes('loan') || rel.includes('http://opds-spec.org/acquisition')) {
                            if (type && (type.includes('epub') || type.includes('pdf') || palaceTypes.some(t => type.includes(t)))) return true;
                            return true;
                        }
                        return false;
                    });
                    if (candidate) {
                        const hrefAttr = candidate.getAttribute('href')!;
                        return new URL(hrefAttr, originalHref).href;
                    }
                }
            } catch (e) {
                // ignore parse errors
            }

            // Fallback: if content-type indicates binary, return current
            const ct = (resp.headers && typeof resp.headers.get === 'function') ? resp.headers.get('Content-Type') || '' : '';
            if (ct.includes('application/epub') || ct.includes('application/pdf') || ct.includes('application/octet-stream')) {
                // Return the canonical upstream URL rather than the proxy URL so
                // callers can decide whether to proxy the download.
                return originalHref;
            }

            // If we received an HTML response (often from a public proxy) and
            // the current URL indicates it was proxied through a known public
            // CORS proxy, surface a clearer error so the UI can show an actionable
            // toast suggesting to use an owned proxy.
            try {
                const responseText = text || await safeReadText(resp).catch(() => '');
                const usedProxy = typeof current === 'string' && (current.includes('corsproxy.io') || current.includes('/proxy?url='));
                if (usedProxy && (ct.includes('text/html') || (responseText && responseText.trim().startsWith('<')))) {
                    const err: any = new Error('Acquisition failed via public CORS proxy. The proxy may block POST requests or strip Authorization headers. Configure an owned proxy (VITE_OWN_PROXY_URL) to preserve credentials and HTTP methods.');
                    err.status = resp.status;
                    err.proxyUsed = true;
                    throw err;
                }
            } catch (e) {
                // ignore and continue
            }
        }

        // If we attempted a direct fetch and received a 401/403 without
        // Access-Control-Allow-Origin, browsers will block reading the body.
        // If an owned proxy is configured, retry the same request via the
        // owned proxy preserving Authorization so the proxy can add CORS
        // headers and forward auth to the upstream. If no owned proxy is
        // configured, surface an actionable error so the UI can instruct
        // the user to configure one.
        try {
            const usedDirect = typeof current === 'string' && current === originalHref;
            const statusIsAuth = resp.status === 401 || resp.status === 403;
            const hasAcaOrigin = resp.headers && typeof resp.headers.get === 'function' && !!resp.headers.get('Access-Control-Allow-Origin');
            if (usedDirect && statusIsAuth && !hasAcaOrigin) {
                // Build a proxied URL candidate and determine if it's an owned proxy
                const proxyCandidate = proxiedUrl(originalHref);
                const usingPublicProxy = proxyCandidate && proxyCandidate.includes('corsproxy.io');
                if (!proxyCandidate) {
                    const err: any = new Error('Acquisition failed and no proxy is available. Configure an owned proxy via VITE_OWN_PROXY_URL to allow authenticated downloads from the browser.');
                    err.proxyUsed = true;
                    throw err;
                }

                if (usingPublicProxy) {
                    // Public proxy would be used but it likely strips Authorization.
                    const err: any = new Error('Acquisition would require using a public CORS proxy which may strip Authorization or block POSTs. Configure an owned proxy (VITE_OWN_PROXY_URL).');
                    err.proxyUsed = true;
                    throw err;
                }

                // Owned proxy exists — retry the request via the owned proxy with same auth headers
                const makeHeadersForRetry = (withCreds = false) => {
                    const h: Record<string, string> = { 'Accept': 'application/atom+xml, application/xml, text/xml, */*' };
                    if (withCreds && credentials) h['Authorization'] = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
                    return h;
                };

                // Choose method sequence as before
                let proxyResp: Response | null = null;
                try {
                    if (preferGetWhenCreds) {
                        proxyResp = await fetch(proxyCandidate, { method: 'GET', headers: makeHeadersForRetry(true) });
                        if (proxyResp && proxyResp.status === 405) proxyResp = await fetch(proxyCandidate, { method: 'POST', headers: makeHeadersForRetry(true) });
                    } else {
                        proxyResp = await fetch(proxyCandidate, { method: 'POST', headers: makeHeadersForRetry(false) });
                        if (proxyResp && proxyResp.status === 405) proxyResp = await fetch(proxyCandidate, { method: 'GET', headers: makeHeadersForRetry(false) });
                    }
                } catch (e) {
                    // Network/proxy error — surface as proxyUsed so UI can guide user
                    const err: any = new Error('Failed to contact owned proxy for authenticated acquisition. Check your proxy configuration.');
                    err.proxyUsed = true;
                    throw err;
                }

                if (!proxyResp) {
                    const err: any = new Error('Proxy retry failed.');
                    err.proxyUsed = true;
                    throw err;
                }

                if (proxyResp.status >= 300 && proxyResp.status < 400) {
                    const loc = (proxyResp.headers && typeof proxyResp.headers.get === 'function') ? (proxyResp.headers.get('Location') || proxyResp.headers.get('location')) : null;
                    if (loc) return new URL(loc, originalHref).href;
                }

                const ok2 = typeof proxyResp.ok === 'boolean' ? proxyResp.ok : (proxyResp.status >= 200 && proxyResp.status < 300);
                if (ok2) {
                    const text2 = await safeReadText(proxyResp).catch(() => '');
                    try {
                        if (text2.trim().startsWith('<')) {
                            const parser = new DOMParser();
                            const xml = parser.parseFromString(text2, 'application/xml');
                            const links = Array.from(xml.querySelectorAll('link')) as Element[];
                            const candidate = links.find(l => {
                                const rel = (l.getAttribute('rel') || '').toLowerCase();
                                const type = (l.getAttribute('type') || '').toLowerCase();
                                const hrefAttr = l.getAttribute('href');
                                if (!hrefAttr) return false;
                                if (rel.includes('acquisition') || rel.includes('borrow') || rel.includes('loan') || rel.includes('http://opds-spec.org/acquisition')) {
                                    if (type && (type.includes('epub') || type.includes('pdf') || palaceTypes.some(t => type.includes(t)))) return true;
                                    return true;
                                }
                                return false;
                            });
                            if (candidate) {
                                const hrefAttr = candidate.getAttribute('href')!;
                                return new URL(hrefAttr, originalHref).href;
                            }
                        }
                    } catch (e) {
                        // ignore
                    }

                    const ct2 = (proxyResp.headers && typeof proxyResp.headers.get === 'function') ? proxyResp.headers.get('Content-Type') || '' : '';
                    if (ct2.includes('application/epub') || ct2.includes('application/pdf') || ct2.includes('application/octet-stream')) {
                        return originalHref;
                    }
                }
                // If proxy retry did not yield a usable acquisition, surface an error
                const err: any = new Error('Authenticated acquisition failed even after retrying via owned proxy.');
                err.proxyUsed = true;
                throw err;
            }
        } catch (e) {
            throw e;
        }

        if (resp.status === 401 || resp.status === 403) {
            const text = await safeReadText(resp).catch(() => '');
            let authDoc: any = null;
            try {
                const ct = resp.headers.get('Content-Type') || '';
                if (ct.includes('application/vnd.opds.authentication.v1.0+json') || text.trim().startsWith('{')) authDoc = JSON.parse(text);
            } catch (e) { authDoc = null; }

            const err: any = new Error(`Acquisition requires authentication: ${resp.status} ${resp.statusText}`);
            err.status = resp.status;
            if (authDoc) err.authDocument = authDoc;
            try { if (typeof current === 'string' && (current.includes('corsproxy.io') || current.includes('/proxy?url='))) err.proxyUsed = true; } catch (e) { /* ignore */ }
            throw err;
        }

        break;
    }

    return null;
};

// Media Type Filtering Functions
export const filterBooksByAudience = (books: CatalogBook[], audienceMode: AudienceMode): CatalogBook[] => {
    if (audienceMode === 'all') {
        return books;
    }

    return books.filter(book => {
        // Check categories for audience information
        if (book.categories && book.categories.length > 0) {
            const audienceCategories = book.categories.filter(cat =>
                cat.scheme.includes('audience') || cat.scheme.includes('target-age'),
            );

            if (audienceCategories.length > 0) {
                const hasTargetAudience = audienceCategories.some(cat => {
                    const label = cat.label.toLowerCase();
                    const term = cat.term.toLowerCase();

                    switch (audienceMode) {
                        case 'adult':
                            return label.includes('adult') && !label.includes('young') ||
                                term.includes('adult') && !term.includes('young') ||
                                label.includes('18+') || term.includes('18+');
                        case 'young-adult':
                            return label.includes('young adult') || label.includes('teen') ||
                                term.includes('young-adult') || term.includes('teen') ||
                                label.includes('ya') || term.includes('ya');
                        case 'children':
                            return label.includes('children') || label.includes('child') ||
                                label.includes('juvenile') || label.includes('kids') ||
                                term.includes('children') || term.includes('child') ||
                                term.includes('juvenile') || term.includes('kids');
                        default:
                            return false;
                    }
                });

                return hasTargetAudience;
            }
        }

        // Check subjects for audience information
        if (book.subjects && book.subjects.length > 0) {
            const hasTargetAudience = book.subjects.some(subject => {
                const subjectLower = subject.toLowerCase();

                switch (audienceMode) {
                    case 'adult':
                        return subjectLower.includes('adult') && !subjectLower.includes('young');
                    case 'young-adult':
                        return subjectLower.includes('young adult') || subjectLower.includes('teen') ||
                            subjectLower.includes('ya');
                    case 'children':
                        return subjectLower.includes('children') || subjectLower.includes('child') ||
                            subjectLower.includes('juvenile') || subjectLower.includes('kids');
                    default:
                        return false;
                }
            });

            if (hasTargetAudience) {
                return true;
            }
        }

        // If no audience information found, include in 'adult' by default
        return audienceMode === 'adult';
    });
};

export const getAvailableAudiences = (books: CatalogBook[]): AudienceMode[] => {
    const audiences: Set<AudienceMode> = new Set(['all']); // Always include 'all'

    books.forEach(book => {
        // Check categories for audience information
        if (book.categories && book.categories.length > 0) {
            book.categories.forEach(cat => {
                if (cat.scheme.includes('audience') || cat.scheme.includes('target-age')) {
                    const label = cat.label.toLowerCase();
                    const term = cat.term.toLowerCase();

                    if ((label.includes('adult') && !label.includes('young')) ||
                        (term.includes('adult') && !term.includes('young')) ||
                        label.includes('18+') || term.includes('18+')) {
                        audiences.add('adult');
                    }
                    if (label.includes('young adult') || label.includes('teen') ||
                        term.includes('young-adult') || term.includes('teen') ||
                        label.includes('ya') || term.includes('ya')) {
                        audiences.add('young-adult');
                    }
                    if (label.includes('children') || label.includes('child') ||
                        label.includes('juvenile') || label.includes('kids') ||
                        term.includes('children') || term.includes('child') ||
                        term.includes('juvenile') || term.includes('kids')) {
                        audiences.add('children');
                    }
                }
            });
        }

        // Check subjects for audience information
        if (book.subjects && book.subjects.length > 0) {
            book.subjects.forEach(subject => {
                const subjectLower = subject.toLowerCase();

                if (subjectLower.includes('adult') && !subjectLower.includes('young')) {
                    audiences.add('adult');
                }
                if (subjectLower.includes('young adult') || subjectLower.includes('teen') ||
                    subjectLower.includes('ya')) {
                    audiences.add('young-adult');
                }
                if (subjectLower.includes('children') || subjectLower.includes('child') ||
                    subjectLower.includes('juvenile') || subjectLower.includes('kids')) {
                    audiences.add('children');
                }
            });
        }
    });

    return Array.from(audiences);
};

export const filterBooksByFiction = (books: CatalogBook[], fictionMode: FictionMode): CatalogBook[] => {
    if (fictionMode === 'all') {
        return books;
    }

    return books.filter(book => {
        // Check categories for fiction classification
        if (book.categories && book.categories.length > 0) {
            const fictionCategories = book.categories.filter(cat =>
                cat.scheme.includes('fiction') || cat.scheme.includes('genre') || cat.scheme.includes('bisac'),
            );

            if (fictionCategories.length > 0) {
                const isFiction = fictionCategories.some(cat => {
                    const label = cat.label.toLowerCase();
                    const term = cat.term.toLowerCase();

                    // Check for explicit fiction markers
                    if (label.includes('fiction') || term.includes('fiction')) {
                        return !label.includes('non-fiction') && !term.includes('non-fiction');
                    }

                    // Check for non-fiction markers
                    if (label.includes('non-fiction') || term.includes('non-fiction') ||
                        label.includes('nonfiction') || term.includes('nonfiction')) {
                        return false;
                    }

                    // Check for genre indicators that suggest fiction
                    const fictionGenres = ['romance', 'mystery', 'thriller', 'fantasy', 'science fiction',
                        'horror', 'adventure', 'literary', 'drama', 'suspense'];
                    const nonFictionGenres = ['biography', 'history', 'science', 'philosophy', 'religion',
                        'self-help', 'health', 'business', 'politics', 'economics'];

                    const hasFictionGenre = fictionGenres.some(genre =>
                        label.includes(genre) || term.includes(genre),
                    );
                    const hasNonFictionGenre = nonFictionGenres.some(genre =>
                        label.includes(genre) || term.includes(genre),
                    );

                    if (hasNonFictionGenre) return false;
                    if (hasFictionGenre) return true;

                    return null; // Unclear from this category
                });

                if (isFiction !== null) {
                    return fictionMode === 'fiction' ? isFiction : !isFiction;
                }
            }
        }

        // Check subjects for fiction classification
        if (book.subjects && book.subjects.length > 0) {
            const fictionKeywords = book.subjects.some(subject => {
                const subjectLower = subject.toLowerCase();

                // Explicit fiction/non-fiction markers
                if (subjectLower.includes('fiction') && !subjectLower.includes('non-fiction')) {
                    return true;
                }
                if (subjectLower.includes('non-fiction') || subjectLower.includes('nonfiction')) {
                    return false;
                }

                // Genre-based classification
                const fictionGenres = ['romance', 'mystery', 'thriller', 'fantasy', 'science fiction',
                    'horror', 'adventure', 'literary', 'drama', 'suspense'];
                const nonFictionGenres = ['biography', 'history', 'science', 'philosophy', 'religion',
                    'self-help', 'health', 'business', 'politics', 'economics'];

                const hasNonFictionGenre = nonFictionGenres.some(genre => subjectLower.includes(genre));
                if (hasNonFictionGenre) return false;

                const hasFictionGenre = fictionGenres.some(genre => subjectLower.includes(genre));
                if (hasFictionGenre) return true;

                return null;
            });

            if (fictionKeywords !== null) {
                return fictionMode === 'fiction' ? fictionKeywords : !fictionKeywords;
            }
        }

        // If no clear fiction classification, include in both categories by default
        return true;
    });
};

export const getAvailableFictionModes = (books: CatalogBook[]): FictionMode[] => {
    const modes: Set<FictionMode> = new Set(['all']); // Always include 'all'

    let hasFiction = false;
    let hasNonFiction = false;

    books.forEach(book => {
        // Check categories for fiction classification
        if (book.categories && book.categories.length > 0) {
            book.categories.forEach(cat => {
                if (cat.scheme.includes('fiction') || cat.scheme.includes('genre') || cat.scheme.includes('bisac')) {
                    const label = String(cat.label || '').toLowerCase();
                    const term = String(cat.term || '').toLowerCase();

                    if ((label.includes('fiction') && !label.includes('non-fiction')) ||
                        (term.includes('fiction') && !term.includes('non-fiction'))) {
                        hasFiction = true;
                    }
                    if (label.includes('non-fiction') || term.includes('non-fiction') ||
                        label.includes('nonfiction') || term.includes('nonfiction')) {
                        hasNonFiction = true;
                    }

                    // Genre-based inference
                    const fictionGenres = ['romance', 'mystery', 'thriller', 'fantasy', 'science fiction',
                        'horror', 'adventure', 'literary', 'drama', 'suspense'];
                    const nonFictionGenres = ['biography', 'history', 'science', 'philosophy', 'religion',
                        'self-help', 'health', 'business', 'politics', 'economics'];

                    const hasFictionGenre = fictionGenres.some(genre =>
                        label.includes(genre) || term.includes(genre),
                    );
                    const hasNonFictionGenre = nonFictionGenres.some(genre =>
                        label.includes(genre) || term.includes(genre),
                    );

                    if (hasFictionGenre) hasFiction = true;
                    if (hasNonFictionGenre) hasNonFiction = true;
                }
            });
        }

        // Check subjects for fiction classification
        if (book.subjects && book.subjects.length > 0) {
            book.subjects.forEach(subject => {
                const subjectLower = String(subject || '').toLowerCase();

                if (subjectLower.includes('fiction') && !subjectLower.includes('non-fiction')) {
                    hasFiction = true;
                }
                if (subjectLower.includes('non-fiction') || subjectLower.includes('nonfiction')) {
                    hasNonFiction = true;
                }

                // Genre-based inference
                const fictionGenres = ['romance', 'mystery', 'thriller', 'fantasy', 'science fiction',
                    'horror', 'adventure', 'literary', 'drama', 'suspense'];
                const nonFictionGenres = ['biography', 'history', 'science', 'philosophy', 'religion',
                    'self-help', 'health', 'business', 'politics', 'economics'];

                const hasFictionGenre = fictionGenres.some(genre => subjectLower.includes(genre));
                const hasNonFictionGenre = nonFictionGenres.some(genre => subjectLower.includes(genre));

                if (hasFictionGenre) hasFiction = true;
                if (hasNonFictionGenre) hasNonFiction = true;
            });
        }
    });

    if (hasFiction) modes.add('fiction');
    if (hasNonFiction) modes.add('non-fiction');

    return Array.from(modes);
};

export const filterBooksByMedia = (books: CatalogBook[], mediaMode: MediaMode): CatalogBook[] => {
    if (mediaMode === 'all') {
        return books;
    }

    return books.filter(book => {
        // Prefer the acquisition link MIME type; fall back to schema/publication typing.
        const mediaType = (book.acquisitionMediaType || book.mediaType)?.toLowerCase();
        const format = book.format?.toUpperCase();

        if (mediaMode === 'epub') {
            return mediaType === 'application/epub+zip' ||
                mediaType?.includes('epub') ||
                format === 'EPUB';
        } else if (mediaMode === 'pdf') {
            return mediaType === 'application/pdf' ||
                mediaType?.includes('pdf') ||
                format === 'PDF';
        } else if (mediaMode === 'audiobook') {
            return mediaType?.includes('bib.schema.org/audiobook') ||
                mediaType?.includes('audiobook') ||
                format === 'AUDIOBOOK';
        }

        return false;
    });
};

export const getAvailableMediaModes = (books: CatalogBook[]): MediaMode[] => {
    const modes: Set<MediaMode> = new Set(['all']); // Always include 'all'

    books.forEach((book) => {
        // Prefer the acquisition link MIME type; fall back to schema/publication typing.
        const mediaType = book.acquisitionMediaType || book.mediaType;
        const mediaTypeLower = mediaType?.toLowerCase();
        const format = book.format?.toUpperCase();

        if (mediaTypeLower?.includes('bib.schema.org/audiobook') ||
            mediaTypeLower?.includes('audiobook') ||
            mediaType === 'http://bib.schema.org/Audiobook' ||
            format === 'AUDIOBOOK') {
            modes.add('audiobook');
        }

        if (mediaTypeLower === 'application/epub+zip' ||
            mediaTypeLower?.includes('epub') ||
            format === 'EPUB') {
            modes.add('epub');
        }

        if (mediaTypeLower === 'application/pdf' ||
            mediaTypeLower?.includes('pdf') ||
            format === 'PDF') {
            modes.add('pdf');
        }
    });

    const result = Array.from(modes);
    return result;
};

const publicationModeFromValue = (value?: string): PublicationMode | undefined => {
    if (!value) return undefined;

    const segment = value
        .trim()
        .split('/')
        .filter(Boolean)
        .pop() || value.trim();

    const slug = segment
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

    return slug || undefined;
};

const getPublicationTypeLabel = (book: CatalogBook): string | undefined => {
    if (book.publicationTypeLabel?.trim()) {
        return book.publicationTypeLabel.trim();
    }

    if (book.schemaOrgType?.trim()) {
        const segment = book.schemaOrgType
            .trim()
            .split('/')
            .filter(Boolean)
            .pop();
        if (!segment) return undefined;
        return segment.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    }

    if (book.format?.toUpperCase() === 'AUDIOBOOK') {
        return 'Audiobook';
    }

    return undefined;
};

const getPublicationModeForBook = (book: CatalogBook): PublicationMode | undefined => {
    return publicationModeFromValue(book.schemaOrgType)
        || publicationModeFromValue(book.publicationTypeLabel)
        || (book.format?.toUpperCase() === 'AUDIOBOOK' ? 'audiobook' : undefined);
};

export const filterBooksByPublication = (books: CatalogBook[], publicationMode: PublicationMode): CatalogBook[] => {
    if (publicationMode === 'all') {
        return books;
    }

    return books.filter((book) => getPublicationModeForBook(book) === publicationMode);
};

export const getAvailablePublicationTypes = (books: CatalogBook[]): Array<{ key: PublicationMode; label: string }> => {
    const publicationTypes = new Map<PublicationMode, string>();

    books.forEach((book) => {
        const key = getPublicationModeForBook(book);
        const label = getPublicationTypeLabel(book);

        if (key && label && !publicationTypes.has(key)) {
            publicationTypes.set(key, label);
        }
    });

    return Array.from(publicationTypes.entries()).map(([key, label]) => ({ key, label }));
};

export const filterBooksByAvailability = (books: CatalogBook[], availabilityMode: AvailabilityMode): CatalogBook[] => {
    if (availabilityMode === 'all') {
        return books;
    }

    return books.filter((book) => (book.availabilityStatus || 'available') === availabilityMode);
};

export const getAvailableAvailabilityModes = (books: CatalogBook[]): Array<{ key: AvailabilityMode; label: string }> => {
    const labels: Record<string, string> = {
        available: 'Available',
        unavailable: 'Unavailable',
        reserved: 'Reserved',
        ready: 'Ready',
    };
    const modes = new Set<string>();

    books.forEach((book) => {
        modes.add(book.availabilityStatus || 'available');
    });

    return Array.from(modes)
        .sort()
        .map((key) => ({ key, label: labels[key] || key.replace(/-/g, ' ') }));
};

export const filterBooksByDistributor = (books: CatalogBook[], distributorMode: DistributorMode): CatalogBook[] => {
    if (distributorMode === 'all') {
        return books;
    }

    return books.filter((book) => (book.distributor || '').trim() === distributorMode);
};

export const getAvailableDistributors = (books: CatalogBook[]): DistributorMode[] => {
    const distributors = new Set<DistributorMode>();

    books.forEach((book) => {
        const distributor = book.distributor?.trim();
        if (distributor) distributors.add(distributor);
    });

    return Array.from(distributors).sort();
};

export const filterBooksByCollection = (books: CatalogBook[], collectionMode: CollectionMode, navLinks: CatalogNavigationLink[] = []): CatalogBook[] => {
    if (collectionMode === 'all') return books;

    // Check if this collection exists as a navigation link
    const collectionNavLink = navLinks.find(link =>
        (link.rel === 'collection' || link.rel === 'subsection') && link.title === collectionMode,
    );

    // If it's a navigation-based collection, we should navigate rather than filter
    // For now, just return the books as-is, since navigation will be handled at the component level
    if (collectionNavLink) {
        return books;
    }

    // Filter books that have this collection in their metadata
    return books.filter(book => {
        return book.collections?.some(collection => collection.title === collectionMode);
    });
};

export const getAvailableCategories = (books: CatalogBook[], navLinks: CatalogNavigationLink[] = []): string[] => {
    const categories = new Set<string>();

    // Extract categories from individual books
    books.forEach(book => {
        if (book.collections && book.collections.length > 0) {
            book.collections.forEach(collection => {
                const titleLower = String(collection.title || '').toLowerCase();
                // Only include categories (groups) - exclude true collections (feeds)
                const isCategory = collection.href.includes('/groups/') ||
                    titleLower === 'fiction' ||
                    titleLower === 'nonfiction' ||
                    titleLower.includes('young adult') ||
                    titleLower.includes('children');

                if (isCategory) {
                    categories.add(collection.title);
                }
            });
        }
    });

    // Extract categories from navigation links
    navLinks.forEach(link => {
        if (link.rel === 'collection' || link.rel === 'subsection') {
            const titleLower = String(link.title || '').toLowerCase();
            // Only include categories (groups)
            const isCategory = link.url.includes('/groups/') ||
                titleLower === 'fiction' ||
                titleLower === 'nonfiction' ||
                titleLower.includes('young adult') ||
                titleLower.includes('children');

            if (isCategory) {
                categories.add(link.title);
            }
        }
    });

    return Array.from(categories).sort();
};

export const getAvailableCollections = (books: CatalogBook[], navLinks: CatalogNavigationLink[] = []): string[] => {
    const collections = new Set<string>();

    // Extract collections from individual books, filtering out categories
    books.forEach(book => {
        if (book.collections && book.collections.length > 0) {
            book.collections.forEach(collection => {
                const titleLower = String(collection.title || '').toLowerCase();
                // Filter out categories (groups) - only include true collections (feeds)
                const isCategory = collection.href.includes('/groups/') ||
                    titleLower === 'fiction' ||
                    titleLower === 'nonfiction' ||
                    titleLower.includes('young adult') ||
                    titleLower.includes('children');

                if (!isCategory) {
                    collections.add(collection.title);
                }
            });
        }
    });

    // Extract collections from navigation links BUT exclude category groupings
    // In Palace OPDS: /feed/ URLs are collections, /groups/ URLs are categories
    navLinks.forEach(link => {
        if (link.rel === 'collection' || link.rel === 'subsection') {
            const titleLower = String(link.title || '').toLowerCase();
            // Distinguish between collections and categories based on URL pattern
            const isCategory = link.url.includes('/groups/') ||
                titleLower === 'fiction' ||
                titleLower === 'nonfiction' ||
                titleLower.includes('young adult') ||
                titleLower.includes('children');

            if (!isCategory) {
                collections.add(link.title);
            }
        }
    });

    return Array.from(collections).sort();
}; export const groupBooksByMode = (books: CatalogBook[], navLinks: CatalogNavigationLink[], pagination: CatalogPagination, mode: CategorizationMode, audienceMode: AudienceMode = 'all', fictionMode: FictionMode = 'all', mediaMode: MediaMode = 'all', collectionMode: CollectionMode = 'all'): CatalogWithCategories => {
    // Apply all filters first
    let filteredBooks = books;
    if (mediaMode !== 'all') {
        filteredBooks = filterBooksByMedia(filteredBooks, mediaMode);
    }

    if (fictionMode !== 'all') {
        filteredBooks = filterBooksByFiction(filteredBooks, fictionMode);
    }

    if (audienceMode !== 'all') {
        filteredBooks = filterBooksByAudience(filteredBooks, audienceMode);
    }

    if (collectionMode !== 'all') {
        filteredBooks = filterBooksByCollection(filteredBooks, collectionMode, navLinks);
    }

    const categoryMap = new Map<string, { category: Category, books: CatalogBook[] }>();
    const collectionLinksSet = new Set<string>();
    const uncategorizedBooks: CatalogBook[] = [];

    // Determine if we are at the root level (no collectionMode or collectionMode === 'all')
    const atRootLevel = !collectionMode || collectionMode === 'all';

    filteredBooks.forEach(book => {
        let hasCategory = false;

        // Handle actual categories from OPDS parsing (preferred)
        if (book.categories && book.categories.length > 0) {
            book.categories.forEach(category => {
                const key = `${category.scheme}|${category.label}`;
                if (!categoryMap.has(key)) {
                    categoryMap.set(key, {
                        category,
                        books: [],
                    });
                }
                categoryMap.get(key)!.books.push(book);
                hasCategory = true;
            });
        } else if (mode === 'subject' && book.subjects && book.subjects.length > 0) {
            // Use subjects as categories (fallback for when categories aren't available)
            book.subjects.forEach(subject => {
                // Create a synthetic category from the subject
                const syntheticCategory: Category = {
                    scheme: 'http://palace.io/subjects',
                    term: subject.toLowerCase().replace(/\s+/g, '-'),
                    label: subject,
                };

                const key = `${syntheticCategory.scheme}|${syntheticCategory.label}`;
                if (!categoryMap.has(key)) {
                    categoryMap.set(key, {
                        category: syntheticCategory,
                        books: [],
                    });
                }
                categoryMap.get(key)!.books.push(book);
                hasCategory = true;
            });
        }

        // Only add collection links to the sidebar if at root level
        if (atRootLevel && book.collections && book.collections.length > 0) {
            book.collections.forEach(collection => {
                collectionLinksSet.add(JSON.stringify(collection));
            });
        }

        if (!hasCategory) {
            uncategorizedBooks.push(book);
        }
    });

    // Only add root-level collections from the original books if at root level
    if (atRootLevel) {
        books.forEach(book => {
            if (book.collections && book.collections.length > 0) {
                book.collections.forEach(collection => {
                    collectionLinksSet.add(JSON.stringify(collection));
                });
            }
        });
    }

    const categoryLanes = Array.from(categoryMap.values()).map(categoryGroup => {
        // Sort books within each category lane
        let sortedBooks = categoryGroup.books;

        // For series, sort by position if available
        if (categoryGroup.category.scheme === 'http://opds-spec.org/series') {
            sortedBooks = [...categoryGroup.books].sort((a, b) => {
                const aPos = a.series?.position || 0;
                const bPos = b.series?.position || 0;
                return aPos - bPos;
            });
        }

        return {
            ...categoryGroup,
            books: sortedBooks,
        };
    });
    const collectionLinks = Array.from(collectionLinksSet).map(json => JSON.parse(json));

    return {
        books: filteredBooks,
        navLinks,
        pagination,
        categoryLanes,
        collectionLinks,
        uncategorizedBooks,
    };
};

export const extractCollectionNavigation = (books: CatalogBook[]): Collection[] => {
    // Extract unique collection navigation links from OPDS 1 books
    const collectionMap = new Map<string, Collection>();

    books.forEach(book => {
        if (book.collections && book.collections.length > 0) {
            book.collections.forEach(collection => {
                // Use href as the unique key since titles might not be unique
                if (!collectionMap.has(collection.href)) {
                    collectionMap.set(collection.href, collection);
                }
            });
        }
    });

    return Array.from(collectionMap.values());
};

// Keep the old function for backward compatibility, but make it work with OPDS 1 collections
export const groupBooksByCollections = (books: CatalogBook[], navLinks: CatalogNavigationLink[], pagination: CatalogPagination): CatalogWithCollections => {
    // Simple implementation that groups books by their collection property
    const collectionMap = new Map<string, CatalogBook[]>();
    const uncategorizedBooks: CatalogBook[] = [];

    books.forEach(book => {
        if (book.collections && book.collections.length > 0) {
            book.collections.forEach(collection => {
                const key = collection.title;
                if (!collectionMap.has(key)) {
                    collectionMap.set(key, []);
                }
                collectionMap.get(key)!.push(book);
            });
        } else {
            uncategorizedBooks.push(book);
        }
    });

    const collections: CollectionGroup[] = Array.from(collectionMap.entries()).map(([title, books]) => ({
        collection: {
            title: title,
            href: books[0]?.collections?.find(c => c.title === title)?.href || '',
        },
        books,
    }));

    return {
        books,
        navLinks,
        pagination,
        collections,
        uncategorizedBooks,
    };
};

export const groupBooksByCategories = (books: CatalogBook[], navLinks: CatalogNavigationLink[], pagination: CatalogPagination): CatalogWithCategories => {
    // Group books by their formal categories
    const categoryMap = new Map<string, { category: Category, books: CatalogBook[] }>();
    const uncategorizedBooks: CatalogBook[] = [];

    books.forEach(book => {
        let hasCategory = false;

        if (book.categories && book.categories.length > 0) {
            book.categories.forEach(category => {
                const key = `${category.scheme}|${category.label}`;
                if (!categoryMap.has(key)) {
                    categoryMap.set(key, {
                        category,
                        books: [],
                    });
                }
                categoryMap.get(key)!.books.push(book);
                hasCategory = true;
            });
        }

        if (!hasCategory) {
            uncategorizedBooks.push(book);
        }
    });

    const categoryLanes = Array.from(categoryMap.values());

    return {
        books,
        navLinks,
        pagination,
        categoryLanes,
        collectionLinks: [],
        uncategorizedBooks,
    };
};

export const filterRedundantCategories = (categoryLanes: { category: Category, books: CatalogBook[] }[]): { category: Category, books: CatalogBook[] }[] => {
    // Simple implementation that removes categories with very few books
    return categoryLanes.filter(lane => lane.books.length >= 2);
};

export const groupBooksByCollectionsAsLanes = (books: CatalogBook[], navLinks: CatalogNavigationLink[], pagination: CatalogPagination): CatalogWithCategories => {
    // Alternative implementation that treats collections as category lanes
    const collectionMap = new Map<string, CatalogBook[]>();
    const uncategorizedBooks: CatalogBook[] = [];

    books.forEach(book => {
        if (book.collections && book.collections.length > 0) {
            book.collections.forEach(collection => {
                const key = collection.title;
                if (!collectionMap.has(key)) {
                    collectionMap.set(key, []);
                }
                collectionMap.get(key)!.push(book);
            });
        } else {
            uncategorizedBooks.push(book);
        }
    });

    const categoryLanes = Array.from(collectionMap.entries()).map(([title, books]) => {
        // Find the first book with collections to get the href for the term
        const firstBookWithCollections = books.find(book => book.collections && book.collections.length > 0);
        const collection = firstBookWithCollections?.collections?.find(c => c.title === title);
        const term = collection?.href || title.toLowerCase().replace(/\s+/g, '-');

        return {
            category: {
                scheme: 'http://opds-spec.org/collection',
                term,
                label: title,
            },
            books,
        };
    });

    // Extract collection links from books
    const collectionLinksMap = new Map<string, { title: string; href: string }>();
    books.forEach(book => {
        if (book.collections) {
            book.collections.forEach(collection => {
                collectionLinksMap.set(collection.title, collection);
            });
        }
    });

    const collectionLinks = Array.from(collectionLinksMap.values());

    return {
        books,
        navLinks,
        pagination,
        categoryLanes,
        collectionLinks,
        uncategorizedBooks,
    };
};
