import React, { useState } from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';

import * as opds2 from '../../services/opds2';
import { proxiedUrl } from '../../services/utils';
import type { CatalogBook } from '../../types';
import BookDetailView from '../BookDetailView';
import OpdsCredentialsModal from '../OpdsCredentialsModal';

describe('Open provider login + Retry flow', () => {
  let origFetch: any;
  beforeEach(() => { origFetch = (globalThis as any).fetch; });
  afterEach(() => { (globalThis as any).fetch = origFetch; vi.restoreAllMocks(); });

  it('opens provider auth link and retries successfully', async () => {
    const user = userEvent.setup();

    const authDoc = { title: 'Library card', description: 'Enter your card number', links: [{ href: 'https://minotaur/auth', title: 'Sign in', rel: 'authenticate' }], username_hint: 'card' };
    const mockResolve = vi.spyOn(opds2, 'resolveAcquisitionChain')
      .mockImplementationOnce(async () => {
        const e: any = new Error('auth required');
        e.status = 401; e.authDocument = authDoc; throw e;
      })
  .mockImplementationOnce(async () => 'https://cdn.example/content/book.epub');

  const mockFetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
    (globalThis as any).fetch = mockFetch;

    // Harness that mimics App import flow for a single BookDetailView
    const TestHarness: React.FC = () => {
      const [importStatus, setImportStatus] = useState({ isLoading: false, message: '', error: null as string | null });
      const [credentialPrompt, setCredentialPrompt] = useState<{ isOpen: boolean; host: string | null; pendingHref?: string | null; pendingBook?: CatalogBook | null; authDocument?: any | null }>({ isOpen: false, host: null, pendingHref: null, pendingBook: null, authDocument: null });

      const handleImportFromCatalog = async (book: CatalogBook) => {
        try {
          await opds2.resolveAcquisitionChain(book.downloadUrl, null);
        } catch (e: any) {
          if (e?.status === 401 && e?.authDocument) {
            setCredentialPrompt({ isOpen: true, host: 'minotaur.dev', authDocument: e.authDocument, pendingHref: book.downloadUrl, pendingBook: book });
            return { success: false };
          }
        }
        return { success: false };
      };

      const handleCredentialSubmit = async (username: string, password: string) => {
        if (!credentialPrompt.pendingHref) return;
        setCredentialPrompt(prev => ({ ...prev, isOpen: false }));
        try {
          const resolved = await opds2.resolveAcquisitionChain(credentialPrompt.pendingHref ?? '', { username, password });
          const proxy = proxiedUrl(resolved ?? '');
          const resp = await fetch(proxy, { headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}` } });
          if (!resp.ok) throw new Error('Download failed');
          await resp.arrayBuffer();
        } catch { /* ignore */ }
      };

  // no-op for test
      const handleRetry = async () => {
        if (!credentialPrompt.pendingHref) return;
        try {
          const resolved = await opds2.resolveAcquisitionChain(credentialPrompt.pendingHref, null);
          const proxy = proxiedUrl(resolved ?? '');
          const resp = await fetch(proxy);
          if (!resp.ok) throw new Error('Download failed');
          await resp.arrayBuffer();
          setCredentialPrompt({ isOpen: false, host: null, pendingHref: null, pendingBook: null });
  } catch { /* ignore */ }
      };

      const sample: CatalogBook = { title: 'Auth Book', author: 'A', coverImage: null, downloadUrl: 'https://opds.example/borrow/1', summary: null, providerId: 'p1', format: 'EPUB' };

      return (
        <div>
          <BookDetailView book={sample} source="catalog" onBack={() => {}} onReadBook={() => {}} onImportFromCatalog={handleImportFromCatalog} importStatus={importStatus} setImportStatus={setImportStatus} />
          <OpdsCredentialsModal isOpen={credentialPrompt.isOpen} host={credentialPrompt.host} authDocument={credentialPrompt.authDocument} onClose={() => setCredentialPrompt(prev => ({ ...prev, isOpen: false }))} onSubmit={handleCredentialSubmit} onRetry={handleRetry} />
        </div>
      );
    };

    render(<TestHarness />);

    const addButton = screen.getByRole('button', { name: /Import to My Shelf/i });
    await user.click(addButton);

    // Modal should appear with Open sign-in page button
    const openBtn = await screen.findByRole('button', { name: /Open sign-in page/i });
    await user.click(openBtn);

    // Click Retry
    const retryBtn = await screen.findByRole('button', { name: /Retry/i });
    await user.click(retryBtn);

    await waitFor(() => expect(mockResolve).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  });
});
