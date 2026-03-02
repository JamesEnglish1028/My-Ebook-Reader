import React, { useState } from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as opds2 from '../../services/opds2';
import { proxiedUrl } from '../../services/utils';
import type { CatalogBook } from '../../types';
import BookDetailView from '../BookDetailView';
import OpdsCredentialsModal from '../OpdsCredentialsModal';

describe('Import flow with authDocument', () => {
  let origFetch: any;
  beforeEach(() => {
    origFetch = (globalThis as any).fetch;
  });
  afterEach(() => {
    (globalThis as any).fetch = origFetch;
    vi.restoreAllMocks();
  });

  it('prompts for credentials when resolver returns authDocument and retries successfully', async () => {
    const user = userEvent.setup();

    // Mock resolveAcquisitionChain: first call throws authDocument error, second call returns URL
    const authDoc = { title: 'Library card', description: 'Enter your card number', links: [{ href: 'https://minotaur/auth', title: 'Sign in', rel: 'authenticate' }], username_hint: 'card' };
    const mockResolve = vi.spyOn(opds2, 'resolveAcquisitionChain')
      .mockImplementationOnce(async () => {
        const e: any = new Error('auth required');
        e.status = 401;
        e.authDocument = authDoc;
        throw e;
      })
    .mockImplementationOnce(async () => 'https://cdn.example/content/book.epub');

    // Mock fetch for download: respond with ok and an ArrayBuffer
  const mockFetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
    (globalThis as any).fetch = mockFetch;

    // Test harness mimicking App import flow
    const TestHarness: React.FC = () => {
      const [importStatus, setImportStatus] = useState({ isLoading: false, message: '', error: null as string | null });
      const [credentialPrompt, setCredentialPrompt] = useState<{ isOpen: boolean; host: string | null; authDocument?: any; pendingHref?: string | null }>({ isOpen: false, host: null });
      const [imported, setImported] = useState(false);

      const handleImportFromCatalog = async (book: CatalogBook) => {
        setImportStatus({ isLoading: true, message: `Downloading ${book.title}...`, error: null });
        try {
          // call resolver; first call will throw with authDocument
          const resolved = await opds2.resolveAcquisitionChain(book.downloadUrl, null);
          if (!resolved) throw new Error('No resolved URL');
          const proxy = proxiedUrl(resolved);
          const resp = await fetch(proxy);
          if (!resp.ok) throw new Error('Download failed');
          await resp.arrayBuffer();
          setImportStatus({ isLoading: false, message: 'Import successful!', error: null });
          setImported(true);
          return { success: true };
        } catch (e: any) {
          if (e?.status === 401 && e?.authDocument) {
            setImportStatus({ isLoading: false, message: '', error: null });
            setCredentialPrompt({ isOpen: true, host: 'minotaur.dev', authDocument: e.authDocument, pendingHref: book.downloadUrl });
            return { success: false };
          }
          setImportStatus({ isLoading: false, message: '', error: e instanceof Error ? e.message : 'Failed' });
          return { success: false };
        }
      };

  const handleCredentialSubmit = async (username: string, password: string) => {
        if (!credentialPrompt.pendingHref) return;
        setCredentialPrompt(prev => ({ ...prev, isOpen: false }));
        setImportStatus({ isLoading: true, message: 'Retrying download...', error: null });
        try {
          const resolved = await opds2.resolveAcquisitionChain(credentialPrompt.pendingHref ?? '', { username, password });
          const proxy = proxiedUrl(resolved ?? '');
          const resp = await fetch(proxy, { headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}` } });
          if (!resp.ok) throw new Error('Download failed');
          await resp.arrayBuffer();
          setImported(true);
          setImportStatus({ isLoading: false, message: 'Import successful!', error: null });
        } catch (e: any) {
          setImportStatus({ isLoading: false, message: '', error: e instanceof Error ? e.message : 'Failed' });
        }
      };

      const sample: CatalogBook = { title: 'Auth Book', author: 'A', coverImage: null, downloadUrl: 'https://opds.example/borrow/1', summary: null, providerId: 'p1', format: 'EPUB' };

      return (
        <div>
          <BookDetailView book={sample} source="catalog" onBack={() => {}} onReadBook={() => {}} onImportFromCatalog={handleImportFromCatalog} importStatus={importStatus} setImportStatus={setImportStatus} />
          <OpdsCredentialsModal isOpen={credentialPrompt.isOpen} host={credentialPrompt.host} authDocument={credentialPrompt.authDocument} onClose={() => setCredentialPrompt(prev => ({ ...prev, isOpen: false }))} onSubmit={handleCredentialSubmit} />
          {imported && <div role="status">IMPORTED</div>}
        </div>
      );
    };

    render(<TestHarness />);

    // Click the Import button
    const addButton = screen.getByRole('button', { name: /Import to My Shelf/i });
    await user.click(addButton);

    // Modal should appear with authDocument info
    await waitFor(() => expect(screen.getByText(/Login to Library card|Authentication required/i)).toBeInTheDocument());

  // Fill username/password and submit using labeled fields
  const usernameInput = screen.getByLabelText(/Username/i);
  const passwordInput = screen.getByLabelText(/Password/i);
  await user.clear(usernameInput);
  await user.type(usernameInput, 'user1');
  await user.type(passwordInput, 'pass1');
  const continueBtn = screen.getByRole('button', { name: /Continue/i });
  await user.click(continueBtn);

    // After submit, resolver should be called again and fetch should be used to download
    await waitFor(() => expect(mockResolve).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((globalThis as any).fetch).toHaveBeenCalled());
    // Imported indicator visible
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('IMPORTED'));
  });
});
