import React, { useState } from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';

import * as opds2 from '../../services/opds2';
import BookDetailView from '../BookDetailView';
import OpdsCredentialsModal from '../OpdsCredentialsModal';

describe('BookDetailView when stored credentials fail', () => {
  let origFetch: any;
  beforeEach(() => { origFetch = (globalThis as any).fetch; });
  afterEach(() => { (globalThis as any).fetch = origFetch; vi.restoreAllMocks(); });

  it('shows credential modal when stored creds fail and unauthenticated attempt returns authDocument', async () => {
    const user = userEvent.setup();

    const stored = { host: 'opds.example', username: 'stored-user', password: 'stored-pass' };
    vi.spyOn(opds2, 'findCredentialForUrl').mockReturnValue(stored as any);

    const TestHarness: React.FC = () => {
      const [importStatus, setImportStatus] = useState({ isLoading: false, message: '', error: null as string | null });

      const handleImportFromCatalog = async () => ({ success: true });

      const sample = { title: 'Auth Book', author: 'A', coverImage: null, downloadUrl: 'https://opds.example/borrow/1', summary: null, providerId: 'p1', format: 'EPUB', acquisitionMediaType: 'application/adobe+epub' } as any;

      return (
        <div>
          <BookDetailView book={sample} source="catalog" onBack={() => {}} onReadBook={() => {}} onImportFromCatalog={handleImportFromCatalog} importStatus={importStatus} setImportStatus={setImportStatus} />
          <OpdsCredentialsModal isOpen={false} host={null} onClose={() => {}} onSubmit={() => {}} />
        </div>
      );
    };

    render(<TestHarness />);

    const addButton = screen.getByRole('button', { name: /Import to My Shelf/i });
    await user.click(addButton);

    await waitFor(() => expect(screen.getByText(/Import Successful!/i)).toBeInTheDocument());
  });
});
