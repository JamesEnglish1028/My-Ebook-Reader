import { useCallback, useState } from 'react';

import { db, generatePdfCover, imageUrlToBase64, logger } from '../../services';
import { extractBookMetadataFromOpf } from '../../services/epubParser';
import { extractOpfXmlFromEpub } from '../../services/epubZipUtils';
import type { BookRecord, CatalogBook } from '../../types';

export interface ImportStatusState {
  isLoading: boolean;
  message: string;
  error: string | null;
}

interface UseImportCoordinatorOptions {
  onCatalogImportSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  bookRecord?: BookRecord;
  existingBook?: BookRecord;
}

const initialImportState: ImportStatusState = {
  isLoading: false,
  message: '',
  error: null,
};

const normalizePublisher = (publisher: CatalogBook['publisher'] | undefined): string | undefined => {
  if (!publisher) return undefined;
  return typeof publisher === 'string' ? publisher : publisher.name;
};

export const useImportCoordinator = ({ onCatalogImportSuccess }: UseImportCoordinatorOptions) => {
  const [importStatus, setImportStatus] = useState<ImportStatusState>(initialImportState);
  const [libraryRefreshFlag, setLibraryRefreshFlag] = useState(0);

  const bumpLibraryRefresh = useCallback(() => {
    setLibraryRefreshFlag((flag) => flag + 1);
  }, []);

  const processAndSaveBook = useCallback(async (
    bookData: ArrayBuffer,
    fileName: string = 'Untitled Book',
    authorName?: string,
    source: 'file' | 'catalog' = 'file',
    providerName?: string,
    providerId?: string,
    format?: string,
    coverImageUrl?: string | null,
    catalogBookMeta?: Partial<CatalogBook>,
  ): Promise<ImportResult> => {
    let finalCoverImage: string | null = null;
    if (coverImageUrl) {
      finalCoverImage = await imageUrlToBase64(coverImageUrl);
    }

    const effectiveFormat = format || (fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'EPUB');

    if (effectiveFormat === 'PDF') {
      setImportStatus({ isLoading: true, message: 'Saving PDF to library...', error: null });
      try {
        const title = fileName.replace(/\.(pdf)$/i, '');
        const author = authorName || 'Unknown Author';

        if (!finalCoverImage && source === 'file') {
          finalCoverImage = await generatePdfCover(title, author);
        }

        const pdfHeader = new Uint8Array(bookData).slice(0, 5);
        const isPdf = pdfHeader[0] === 0x25 && pdfHeader[1] === 0x50 && pdfHeader[2] === 0x44 && pdfHeader[3] === 0x46 && pdfHeader[4] === 0x2d;
        if (!isPdf || !bookData || (bookData instanceof ArrayBuffer && bookData.byteLength < 1000)) {
          setImportStatus({ isLoading: false, message: '', error: 'Downloaded file is not a valid PDF or is empty. Import aborted.' });
          return { success: false };
        }

        let validCover = finalCoverImage;
        if (validCover && typeof validCover === 'string' && !/^data:image\/(png|jpeg|jpg);base64,/.test(validCover)) {
          validCover = null;
        }

        let catalogMeta = {};
        if (source === 'catalog' && catalogBookMeta) {
          catalogMeta = {
            summary: catalogBookMeta.summary,
            publisher: catalogBookMeta.publisher,
            publicationDate: catalogBookMeta.publicationDate,
            subjects: catalogBookMeta.subjects,
            coverImage: validCover || (catalogBookMeta.coverImage ? await imageUrlToBase64(catalogBookMeta.coverImage) : null),
          };
        }

        if (source === 'catalog' && !((catalogMeta as { coverImage?: string | null }).coverImage)) {
          setImportStatus({ isLoading: false, message: '', error: 'No valid cover image found for this book. Import aborted.' });
          return { success: false };
        }

        const newBook: BookRecord = {
          title,
          author,
          coverImage: (catalogMeta as { coverImage?: string | null }).coverImage || validCover,
          epubData: bookData,
          format: 'PDF',
          providerName,
          providerId,
          description: (catalogMeta as Partial<CatalogBook>).summary,
          publisher: normalizePublisher((catalogMeta as Partial<CatalogBook>).publisher),
          publicationDate: (catalogMeta as Partial<CatalogBook>).publicationDate,
          subjects: (catalogMeta as Partial<CatalogBook>).subjects,
        };
        await db.saveBook(newBook);
        setImportStatus({ isLoading: false, message: 'Import successful!', error: null });
        bumpLibraryRefresh();
        setTimeout(() => setImportStatus(initialImportState), 2000);
        return { success: true };
      } catch (error) {
        logger.error('Error saving PDF:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save the PDF file to the library.';
        setImportStatus({ isLoading: false, message: '', error: errorMessage });
        return { success: false };
      }
    }

    setImportStatus({ isLoading: true, message: 'Extracting EPUB metadata...', error: null });
    let opfXml: string | undefined;
    let opfMetadata: Record<string, unknown> | undefined;
    try {
      try {
        opfXml = await extractOpfXmlFromEpub(bookData);
      } catch (opfErr) {
        logger.error('[processAndSaveBook] Failed to extract OPF XML:', opfErr);
        setImportStatus({ isLoading: false, message: '', error: 'Failed to extract EPUB metadata (OPF not found). Importing with minimal info.' });
      }

      if (opfXml) {
        try {
          opfMetadata = extractBookMetadataFromOpf(opfXml) as unknown as Record<string, unknown>;
        } catch (parseErr) {
          logger.error('[processAndSaveBook] Failed to parse OPF metadata:', parseErr);
          setImportStatus({ isLoading: false, message: '', error: 'Failed to parse EPUB metadata. Importing with minimal info.' });
        }
      }

      setImportStatus((prev) => ({ ...prev, message: 'Extracting cover...' }));
      if (!finalCoverImage) {
        try {
          const { extractCoverImageFromEpub } = await import('../../services/epubZipUtils');
          finalCoverImage = await extractCoverImageFromEpub(bookData);
        } catch (coverErr) {
          logger.error('[processAndSaveBook] Failed to extract cover image:', coverErr);
        }
      }

      const finalProviderId = providerId || (opfMetadata?.identifiers as string[] | undefined)?.[0];
      const newBook: BookRecord = {
        title: (opfMetadata?.title as string | undefined) || fileName,
        author: (opfMetadata?.author as string | undefined) || authorName || 'Unknown Author',
        coverImage: finalCoverImage,
        epubData: bookData,
        publisher: opfMetadata?.publisher as string | undefined,
        publicationDate: opfMetadata?.publicationDate as string | undefined,
        providerId: finalProviderId,
        providerName,
        description: opfMetadata?.description as string | undefined,
        subjects: opfMetadata?.subjects as BookRecord['subjects'] | undefined,
        format: 'EPUB',
        language: opfMetadata?.language as string | undefined,
        rights: opfMetadata?.rights as string | undefined,
        identifiers: opfMetadata?.identifiers as string[] | undefined,
        opfRaw: opfXml,
        accessModes: opfMetadata?.accessModes as string[] | undefined,
        accessModesSufficient: opfMetadata?.accessModesSufficient as string[] | undefined,
        accessibilityFeatures: opfMetadata?.accessibilityFeatures as string[] | undefined,
        hazards: opfMetadata?.hazards as string[] | undefined,
        accessibilitySummary: opfMetadata?.accessibilitySummary as string | undefined,
        certificationConformsTo: Array.isArray(opfMetadata?.certificationConformsTo)
          ? (opfMetadata?.certificationConformsTo as string[])
          : typeof opfMetadata?.certificationConformsTo === 'string'
            ? [opfMetadata.certificationConformsTo]
            : undefined,
        certification: opfMetadata?.certification as string | undefined,
        accessibilityFeedback: opfMetadata?.accessibilityFeedback as string | undefined,
      };

      if (finalProviderId) {
        const existing = await db.findBookByIdentifier(finalProviderId);
        if (existing) {
          setImportStatus(initialImportState);
          return { success: false, bookRecord: newBook, existingBook: existing };
        }
      }

      setImportStatus((prev) => ({ ...prev, message: 'Saving to library...' }));
      await db.saveBook(newBook);
      setImportStatus({ isLoading: false, message: 'Import successful!', error: null });
      bumpLibraryRefresh();
      setTimeout(() => setImportStatus(initialImportState), 2000);

      if (source === 'catalog') {
        onCatalogImportSuccess();
      }

      return { success: true };
    } catch (error) {
      logger.error('Error processing EPUB:', error);
      let errorMessage = 'Failed to import the EPUB file. It might be corrupted or in an unsupported format.';
      if (error instanceof Error && error.message.includes('File is not a zip')) {
        errorMessage = "The provided file is not a valid EPUB (it's not a zip archive). Please try a different file.";
      }
      setImportStatus({ isLoading: false, message: '', error: errorMessage });
      return { success: false };
    }
  }, [bumpLibraryRefresh, onCatalogImportSuccess]);

  return {
    importStatus,
    setImportStatus,
    libraryRefreshFlag,
    processAndSaveBook,
  };
};
