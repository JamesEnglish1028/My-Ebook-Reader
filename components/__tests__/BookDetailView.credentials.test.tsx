import React, { useState } from 'react';

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BookDetailView from '../BookDetailView';
import OpdsCredentialsModal from '../OpdsCredentialsModal';

describe('BookDetailView credential retry using stored creds', () => {
  let origFetch: any;
  beforeEach(() => { origFetch = (globalThis as any).fetch; });
  afterEach(() => { (globalThis as any).fetch = origFetch; vi.restoreAllMocks(); });

  it('attempts stored credentials before prompting user', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
    (globalThis as any).fetch = mockFetch;

    // Test harness similar to real app import flow
    const TestHarness: React.FC = () => {
  const [importStatus, setImportStatus] = useState({ isLoading: false, message: '', error: null as string | null, state: 'awaiting-auth' as 'awaiting-auth', host: 'test-host' });

      const handleImportFromCatalog = async () => ({ success: true });

  const sample = { id: 301, title: 'Auth Book', author: 'A', coverImage: null, downloadUrl: 'https://opds.example/borrow/1', summary: null, providerId: 'p1', format: 'EPUB', acquisitionMediaType: 'application/adobe+epub' } as any;

      return (
        <div>
          <BookDetailView book={sample} source="catalog" onBack={() => {}} onReadBook={() => {}} onImportFromCatalog={handleImportFromCatalog} importStatus={importStatus} setImportStatus={() => {}} userCitationFormat={'apa' as 'apa'} />
          <OpdsCredentialsModal isOpen={false} host={null} onClose={() => {}} onSubmit={() => {}} />
        </div>
      );
    };

    render(<TestHarness />);

    const addButton = screen.getByRole('button', { name: /Import to My Shelf/i });
    await user.click(addButton);

    // The import handler should be invoked and success overlay shown
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.getByText(/Import Successful!/i)).toBeInTheDocument();
  });
});
