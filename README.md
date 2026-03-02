# MeBooks

A local-first, browser-based reading app for EPUB, PDF, and audiobook content. MeBooks is built with React + TypeScript and focuses on readable interfaces, resilient local persistence, authenticated catalog access, and practical offline-friendly behavior.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/JamesEnglish1028/JamesEnglish1028-My-Ebook-Reader)

## What MeBooks Does

- Maintains a local `My Shelf` backed by IndexedDB.
- Imports local EPUB, PDF, and audiobook manifest files.
- Browses OPDS 1 and OPDS 2 catalogs, including Palace-style feeds and registries.
- Reads EPUB and PDF content in-browser.
- Plays audiobooks from manifest-driven remote tracks, including authenticated loans.
- Stores reading state, annotations, and UI preferences locally.
- Optionally syncs shelf metadata and eligible content snapshots to Google Drive.

## Current Feature Set

### My Shelf

- Local-first storage for books, covers, reading positions, bookmarks, citations, and view state.
- `My Shelf` naming throughout the UI (replacing the older `My Library` wording).
- Grid and inline shelf layouts.
- Inline list rows with cover, title, format badge, and provider badge.
- Shelf filters for:
  - format
  - provider
- Provider grouping in inline view.
- Local file imports are marked as `Local Upload` so they remain filterable and identifiable.

### Catalogs and Loans

- Add and manage custom OPDS catalogs and registries.
- OPDS 1 and OPDS 2 parsing.
- Palace registry integration and launch/import support.
- Remote catalog search using OpenSearch when feeds advertise it.
- Loans feed awareness:
  - titles already imported to `My Shelf` are badged `In My Shelf`
  - duplicate imports are blocked in the detail view with `Already in My Shelf`
- Protected-content detection in catalog detail views:
  - Readium LCP titles are marked and blocked
  - Adobe DRM titles are marked and blocked

### EPUB Reader

- `epub.js` rendering.
- Paginated and scrolled reading modes.
- Per-book font size persistence.
- Font family controls.
- Reader-side search with highlighted results.
- TOC, bookmarks, and citations side panel.
- Citation creation and RIS export.
- Read-aloud / text-to-speech controls with voice, rate, and pitch.
- Shortcut help modal and keyboard navigation.
- Safer rendition lifecycle handling around delayed resize and teardown.

### PDF Reader

- `react-pdf` + `pdfjs-dist` rendering with bundled worker support.
- Lazy-loaded PDF reader module.
- PDF outline/TOC mapping into the shared navigation panel.
- Page slider, page jump input, zoom controls, and fit toggle.
- Footer paging layout aligned with the EPUB reader.
- Shared bookmark/citation/navigation tooling with theme-consistent controls.
- Chunk-load recovery support via the shared error boundary for stale deploy caches.

### Audiobook Support

- Audiobook manifest parsing and dedicated player view.
- Track URLs constructed from authenticated manifest data.
- Per-track progress tracking and saved resume positions.
- TOC/chapter progress indicators with status (`Not Started`, `In Progress`, `Finished`).
- On-demand track fetching (tracks are not pre-downloaded in bulk).
- Temporary blob playback for active tracks only; track binaries are not permanently stored locally.
- Refresh flow for expiring authenticated audiobook access:
  - preserve fulfillment and manifest URLs
  - persist auth documents when needed
  - refresh bearer tokens after `401`
  - rebuild refreshed track URLs from renewed manifest data
  - propagate refreshed auth to track hosts

### Sync and Backup

- Google Drive manual sync from the app menu.
- Timestamped cloud snapshots / restore points.
- Restore selection when downloading from Drive.
- Protected catalog EPUB/PDF items can sync as metadata-only records:
  - their protected file payloads are not uploaded
  - restored records remain visible
  - the UI marks them `Re-download to Read`

### UI / Theming

- Shared theme token system for light and dark modes.
- Consistent theme-based buttons, accents, focus rings, and selected states across:
  - library menus
  - source management
  - reader controls
  - shared modals and panels
- Removal of older logo-heavy header branding in favor of cleaner theme-driven UI.

### Reliability / Error Handling

- Shared error boundaries around major views.
- One-time automatic reload on stale dynamic chunk-load failures (for deploy/cache mismatches).
- Improved proxy handling for CORS and rate-limited responses.
- Clearer blocking behavior for unsupported imports instead of failing late.

## Supported Formats

### Fully supported

- EPUB
- PDF
- Audiobook manifests

### Detected but intentionally blocked

- Readium LCP-protected content
- Adobe DRM-protected content

These are identified in the catalog UI and cannot be imported by this application.

## Architecture Notes

The app uses a domain-oriented structure with shared services and typed domain modules:

- `domain/book`
- `domain/catalog`
- `domain/reader`
- `domain/sync`

Key architectural patterns in the current codebase:

- service-layer organization for domain operations
- typed repositories and shared models
- result-oriented flow in several service paths
- local persistence through IndexedDB plus LocalStorage
- lazy-loaded heavyweight reader code where appropriate

## Developer Setup

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run the dev server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## Testing

Run the full test suite:

```bash
npm test
```

Useful targeted commands:

```bash
npm test -- components/__tests__/PdfReaderView.test.tsx
npm test -- components/__tests__/ErrorBoundary.test.tsx
npm test -- components/__tests__/SettingsModal.auth-state.test.tsx
```

## Type Checking

```bash
npx tsc --noEmit
```

Note: the repository may still contain broader in-progress or legacy type issues outside recently touched paths.

## Important Implementation Notes

- PDF rendering depends on a compatible `pdfjs-dist` worker bundle.
- EPUB rendering assumes the browser runtime can load `epub.js`.
- Audiobook tracks are fetched on demand and played from temporary blob URLs.
- Some authenticated catalog flows depend on a configured owned proxy for the most reliable CORS behavior.

## Repo Notes

- The app includes several integration and migration documents in the repo for older implementation phases.
- Some untracked or in-progress UI work may exist locally during development; keep commits scoped carefully.
