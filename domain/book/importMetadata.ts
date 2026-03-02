import type { AuthDocument, CatalogBook } from '../catalog/types';

const isHttpUrl = (value: string | undefined | null): value is string => {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
};

export type CatalogImportMeta = Pick<Partial<CatalogBook>, 'summary' | 'publisher' | 'publicationDate' | 'subjects' | 'coverImage' | 'downloadUrl'> & {
  manifestUrl?: string;
  fulfillmentUrl?: string;
  authDocument?: AuthDocument;
  contentExcludedFromSync?: boolean;
  requiresReauthorization?: boolean;
};

interface BuildCatalogImportMetaOptions {
  resolvedDownloadUrl?: string;
  fulfillmentUrl?: string;
  authDocument?: AuthDocument | null;
}

export const buildCatalogImportMeta = (
  book: CatalogBook,
  options: BuildCatalogImportMetaOptions = {},
): CatalogImportMeta => {
  const normalizedFormat = (book.format || '').toUpperCase();
  const shouldExcludeContentFromSync = !book.isOpenAccess;
  const baseMeta: CatalogImportMeta = {
    contentExcludedFromSync: shouldExcludeContentFromSync || undefined,
  };

  if (normalizedFormat === 'PDF') {
    return {
      ...baseMeta,
      summary: book.summary,
      publisher: book.publisher,
      publicationDate: book.publicationDate,
      subjects: book.subjects,
      coverImage: book.coverImage,
    };
  }

  if (normalizedFormat === 'AUDIOBOOK') {
    const resolvedUrl = options.resolvedDownloadUrl || book.downloadUrl;
    return {
      ...baseMeta,
      summary: book.summary,
      publisher: book.publisher,
      publicationDate: book.publicationDate,
      subjects: book.subjects,
      coverImage: book.coverImage,
      downloadUrl: resolvedUrl,
      manifestUrl: resolvedUrl,
      fulfillmentUrl: options.fulfillmentUrl || book.downloadUrl,
      authDocument: options.authDocument || undefined,
    };
  }

  return baseMeta;
};

export const resolveStoredImportSourceUrls = (
  meta: CatalogImportMeta | undefined,
  providerId?: string,
): {
  manifestUrl?: string;
  fulfillmentUrl?: string;
} => {
  const fallbackUrl = isHttpUrl(providerId) ? providerId : undefined;
  return {
    manifestUrl: meta?.manifestUrl || meta?.downloadUrl || fallbackUrl,
    fulfillmentUrl: meta?.fulfillmentUrl || meta?.downloadUrl || fallbackUrl,
  };
};
