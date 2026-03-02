import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useImportCoordinator } from '../app/useImportCoordinator';

const {
  saveBook,
  findBookByIdentifier,
  imageUrlToBase64,
  generatePdfCover,
} = vi.hoisted(() => ({
  saveBook: vi.fn(),
  findBookByIdentifier: vi.fn(),
  imageUrlToBase64: vi.fn(),
  generatePdfCover: vi.fn(),
}));

vi.mock('../../services', () => ({
  db: {
    saveBook,
    findBookByIdentifier,
  },
  generatePdfCover,
  imageUrlToBase64,
  logger: {
    error: vi.fn(),
  },
}));

describe('useImportCoordinator', () => {
  beforeEach(() => {
    saveBook.mockReset();
    findBookByIdentifier.mockReset();
    imageUrlToBase64.mockReset();
    generatePdfCover.mockReset();
    imageUrlToBase64.mockResolvedValue('data:image/png;base64,cover');
    generatePdfCover.mockResolvedValue('data:image/png;base64,fallback');
    saveBook.mockResolvedValue(42);
  });

  it('replaces a synced placeholder when re-importing a protected catalog PDF', async () => {
    findBookByIdentifier.mockResolvedValue({
      id: 17,
      title: 'Placeholder',
      author: 'Author',
      coverImage: null,
      epubData: new ArrayBuffer(1),
      format: 'PDF',
      providerId: 'loan-123',
      contentExcludedFromSync: true,
      requiresReauthorization: true,
      restoredFromSync: true,
    });

    const onCatalogImportSuccess = vi.fn();
    const { result } = renderHook(() => useImportCoordinator({ onCatalogImportSuccess }));
    const pdfBytes = new Uint8Array(1200);
    pdfBytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    let importResult;
    await act(async () => {
      importResult = await result.current.processAndSaveBook(
        pdfBytes.buffer,
        'Protected Loan.pdf',
        'Loan Author',
        'catalog',
        'Palace',
        'loan-123',
        'PDF',
        null,
        {
          contentExcludedFromSync: true,
          requiresReauthorization: true,
          summary: 'Loaned title',
          publisher: 'Palace',
        },
      );
    });

    expect(importResult).toEqual({ success: true });
    expect(saveBook).toHaveBeenCalledWith(expect.objectContaining({
      id: 17,
      providerId: 'loan-123',
      contentExcludedFromSync: false,
      requiresReauthorization: false,
      restoredFromSync: false,
    }));
    expect(onCatalogImportSuccess).not.toHaveBeenCalled();
  });
});
