import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LibraryView from '../LibraryView';

const importButtonSpy = vi.fn();
const localLibraryViewSpy = vi.fn();
const authState = {
  user: null,
  isLoggedIn: false,
  signIn: vi.fn(),
  reauthorizeDrive: vi.fn(),
  signOut: vi.fn(),
  tokenClient: null,
  isInitialized: true,
  authStatus: 'ready' as const,
  authError: null as string | null,
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../../../hooks', () => ({
  bookKeys: {
    all: ['books'],
  },
  useCatalogs: () => ({
    catalogs: [],
    registries: [],
    addCatalog: vi.fn(),
    deleteCatalog: vi.fn(),
    updateCatalog: vi.fn(),
    addRegistry: vi.fn(),
    deleteRegistry: vi.fn(),
    updateRegistry: vi.fn(),
  }),
  useUiTheme: () => ({
    uiTheme: 'system',
    setUiTheme: vi.fn(),
  }),
}));

vi.mock('../catalog', () => ({
  CatalogView: () => <div>Catalog View</div>,
}));

vi.mock('../../ManageCatalogsModal', () => ({
  default: () => null,
}));

vi.mock('../../DuplicateBookModal', () => ({
  default: () => null,
}));

vi.mock('../local', () => ({
  ImportButton: (props: unknown) => {
    importButtonSpy(props);
    return <div>Import Button</div>;
  },
  LocalLibraryView: (props: unknown) => {
    localLibraryViewSpy(props);
    return <div>Local Library</div>;
  },
}));

describe('LibraryView local import menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoggedIn = false;
    authState.isInitialized = true;
    authState.authStatus = 'ready';
    authState.authError = null;
  });

  it('backs up to Drive after a successful local import', async () => {
    const queryClient = new QueryClient();
    const autoBackupSpy = vi.fn().mockResolvedValue(undefined);
    const processAndSaveBook = vi.fn().mockResolvedValue({ success: true });
    const originalFileReader = global.FileReader;

    class MockFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
      error: DOMException | null = null;

      readAsArrayBuffer(_blob: Blob) {
        const result = new ArrayBuffer(2048);
        queueMicrotask(() => {
          this.onload?.({
            target: { result },
          } as ProgressEvent<FileReader>);
        });
      }
    }

    global.FileReader = MockFileReader as unknown as typeof FileReader;

    try {
      render(
        <QueryClientProvider client={queryClient}>
          <LibraryView
            libraryRefreshFlag={0}
            syncStatus={{ state: 'idle', message: '' }}
            onAutoBackupToDrive={autoBackupSpy}
            onOpenBook={vi.fn()}
            onShowBookDetail={vi.fn()}
            processAndSaveBook={processAndSaveBook}
            importStatus={{ isLoading: false, message: '', error: null }}
            setImportStatus={vi.fn()}
            activeOpdsSource={null}
            setActiveOpdsSource={vi.fn()}
            catalogNavPath={[]}
            setCatalogNavPath={vi.fn()}
            onOpenCloudSyncModal={vi.fn()}
            onOpenLocalStorageModal={vi.fn()}
            onShowAbout={vi.fn()}
          />
        </QueryClientProvider>,
      );

      const onFileChange = (localLibraryViewSpy.mock.calls.at(-1)?.[0] as {
        onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
      }).onFileChange;

      const file = new File([new Uint8Array(2048)], 'example.epub', { type: 'application/epub+zip' });
      const event = {
        target: {
          files: [file],
          value: '',
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      onFileChange(event);

      await waitFor(() => expect(processAndSaveBook).toHaveBeenCalled());
      await waitFor(() => expect(autoBackupSpy).toHaveBeenCalledTimes(1));
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('keeps the file input mounted until a file is selected', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <LibraryView
          libraryRefreshFlag={0}
          syncStatus={{ state: 'idle', message: '' }}
          onAutoBackupToDrive={vi.fn().mockResolvedValue(undefined)}
          onOpenBook={vi.fn()}
          onShowBookDetail={vi.fn()}
          processAndSaveBook={vi.fn().mockResolvedValue({ success: true })}
          importStatus={{ isLoading: false, message: '', error: null }}
          setImportStatus={vi.fn()}
          activeOpdsSource={null}
          setActiveOpdsSource={vi.fn()}
          catalogNavPath={[]}
          setCatalogNavPath={vi.fn()}
          onOpenCloudSyncModal={vi.fn()}
          onOpenLocalStorageModal={vi.fn()}
          onShowAbout={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Open main menu/i }));

    expect(importButtonSpy).toHaveBeenCalled();
    expect(importButtonSpy.mock.calls.at(-1)?.[0]).toMatchObject({
      isLoading: false,
      alwaysShowLabel: true,
    });
    expect((importButtonSpy.mock.calls.at(-1)?.[0] as { onActivate?: unknown })?.onActivate).toBeUndefined();
  });

  it('shows a Log In action in the main menu when logged out', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <LibraryView
          libraryRefreshFlag={0}
          syncStatus={{ state: 'idle', message: '' }}
          onAutoBackupToDrive={vi.fn().mockResolvedValue(undefined)}
          onOpenBook={vi.fn()}
          onShowBookDetail={vi.fn()}
          processAndSaveBook={vi.fn().mockResolvedValue({ success: true })}
          importStatus={{ isLoading: false, message: '', error: null }}
          setImportStatus={vi.fn()}
          activeOpdsSource={null}
          setActiveOpdsSource={vi.fn()}
          catalogNavPath={[]}
          setCatalogNavPath={vi.fn()}
          onOpenCloudSyncModal={vi.fn()}
          onOpenLocalStorageModal={vi.fn()}
          onShowAbout={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Open main menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Log In$/i }));

    expect(authState.signIn).toHaveBeenCalledTimes(1);
  });
});
