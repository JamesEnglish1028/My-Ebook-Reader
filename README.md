# MeBooks

A local-first, browser-based ebook reader that supports EPUB and PDF. MeBooks is built as a Single Page Application using React + TypeScript and focuses on a smooth reading experience, per-book persistence, and offline-first behavior.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/JamesEnglish1028/JamesEnglish1028-My-Ebook-Reader)

<!-- Trigger Pages rebuild: 2025-10-18T21:40:00Z -->

This README summarizes the current state (features implemented), developer setup, build instructions, and a short changelog for this release.

## Current features (highlight)

- Library: import EPUB and PDF files and store them locally in IndexedDB.
- EPUB reader: paginated and scrolled flows, font-family and font-size customization, themes (light/dark), bookmarks, citations, full-text search, and read-aloud (TTS).
- PDF reader: DOM-based PDF rendering using react-pdf/pdfjs (lazy-loaded) with per-book zoom and fit controls and a TOC mapped from PDF outlines. Note: PDFs are supported — the project ships with a bundle-friendly pdf.worker import and the app requires compatible `pdfjs-dist`/worker versions; the dev environment pins compatible versions to avoid the worker/API mismatch.
- Keyboard shortcuts: navigation and reader controls are available via keyboard (help overlay lists shortcuts).
- Accessibility: focus management and aria attributes on modals and the help overlay; keyboard-trappable help dialog.
- Persistence: per-book last-read positions, per-book view state (PDF zoom / EPUB font-size), bookmarks, and citations saved in LocalStorage and IndexedDB.
- **Book Details Page**: Restored and enhanced layout with two-column design, top-aligned cover and title, accessible font sizes and spacing, format badges (EPUB, PDF, Audiobook) matching catalog views, and citation format support (APA, MLA, Chicago). Includes backup and type updates for reliability.
- **Palace Registry Integration**: Automatic OPDS catalog import when launched from registry applications. Supports URL parameters `?import=<catalogUrl>&name=<catalogName>` for seamless catalog discovery and addition with user feedback and error handling.
- **OPDS 2.0 Full Support**: Complete implementation of OPDS 2.0 specification with work/edition relationships, comprehensive accessibility metadata, series organization, and advanced filtering. See [OPDS2_IMPLEMENTATION_SUMMARY.md](OPDS2_IMPLEMENTATION_SUMMARY.md) for details.
# Book Details Page

The Book Details page provides a visually clear, accessible, and feature-rich view for each book:

- **Layout**: Two-column design with top-aligned book cover and title/details. Book title is large and accessible, with spacing and alignment for clarity.
- **Format Badges**: Book format (EPUB, PDF, Audiobook) and publication type are shown as colored badges using a shared badge component (`BookBadges.tsx`). This ensures consistent badge logic and UI in both the catalog/grid view (`BookCard.tsx`) and the Book Detail view (`BookDetailView.tsx`).
  - Badges are only shown if the relevant metadata (e.g., format, publicationTypeLabel) is present in the book object. Imported books may not display badges if metadata is missing.
- **Accessibility**: Font sizes, spacing, and color contrast are chosen for readability. Title font is large but balanced, and all interactive elements have clear focus states.
- **Citation Format Support**: Citations can be created and exported in APA or MLA style, with the format tracked per citation.
- **Backup**: The original BookDetailView.tsx is archived for reference and rollback.
- **Publisher ID (ISBN)**: If the book's metadata includes an ISBN, it is displayed as the Publisher ID directly under the Publication Date for clear provenance and cataloging.
- **Edition Switching**: When multiple editions of the same work are available (different formats, languages, or publishers), users can switch between them using the EditionSelector component. Preferred editions are highlighted.

See `components/BookDetailView.tsx` and `archive/backups/components/BookDetailView.tsx.backup` for implementation and backup. Type updates for citations are in `domain/reader/types.ts` and service logic in `domain/reader/citation-service.ts`.

# OPDS 2.0 Features

MeBooks provides comprehensive OPDS 2.0 support with advanced metadata display and filtering capabilities:

## Catalog Features

- **Accessibility Metadata**: Display of 25+ accessibility features including alternative text, audio descriptions, bookmarks, braille support, captions, and more. WCAG conformance levels are tracked and displayed. Accessibility hazards are also shown with visual warnings.
- **Language Support**: Books can be filtered by language, with 15+ languages mapped to user-friendly labels (English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Chinese, Arabic, Korean, Dutch, Polish, Turkish, Vietnamese).
- **Acquisition Types**: Books are categorized by access type (open-access/free, borrow, buy, sample) with color-coded badges for easy identification.
- **Availability Status**: For borrowable books, copy availability is displayed with color coding (green for >5 copies, yellow for 1-5 copies, red for 0 copies). Borrow periods and hold counts are also shown.
- **Series Organization**: Books in series are grouped together with position indicators, sorted by series position. Series lanes provide visual organization and links to series landing pages.
- **Advanced Filtering**: Comprehensive filtering by language, accessibility features, acquisition type, and availability status. Filter results update in real-time with active filter count display.

## Work & Edition Features

- **Work Relationships**: Track parent/child works, editions, translations, adaptations, and alternate versions. Books can reference related works for enhanced discovery.
- **Edition Tracking**: Multiple editions of the same work (different formats, languages, publication dates) are tracked separately with edition-specific metadata (format, language, publisher, description).
- **Preferred Editions**: Editions can be marked as preferred for default display. Users can switch between editions seamlessly.
- **Edition Discovery**: When viewing a book, available editions are displayed in an EditionSelector component, showing format, language, year, and description for each edition.

## Metadata Enhancements

- **Publisher Information**: Publisher names, URIs, and countries are captured and displayed.
- **Identifiers**: Multiple identifier schemes are supported (ISBN, ISSN, UUID, URI, DOI) with automatic scheme inference for unknown identifiers.
- **Contributors**: Contributor roles (author, editor, translator, illustrator, narrator) are extracted and displayed.
- **Subjects**: Publication subjects are preserved with scheme and code information for enhanced categorization.
- **Duration & Extent**: Audiobook duration and book extent (page count) are captured for media-specific metadata.

See [OPDS2_IMPLEMENTATION_SUMMARY.md](OPDS2_IMPLEMENTATION_SUMMARY.md) for complete implementation details and [OPDS2_QUICK_REFERENCE.md](OPDS2_QUICK_REFERENCE.md) for developer reference.

## Notable implementation details

- EPUB rendering: uses the embedded `epub.js` runtime available in the browser environment for DOM-based EPUB rendering and interaction.
- PDF rendering: uses `react-pdf` and `pdfjs-dist`; the worker file is statically imported to ensure correct MIME and bundler handling.
- Bundling & dev server: the project uses Vite for development and production builds.
- **Architecture** (Phase 2): Domain-driven design with service layer providing type-safe operations, Result pattern error handling, and comprehensive logging.

## Dependencies

Core dependencies are declared in `package.json`. Key runtime libraries include:

- react, react-dom
- react-router-dom
- react-pdf
- pdfjs-dist

Dev dependencies include Vite, TypeScript, and React type packages.

## Developer setup

Prerequisites:

- Node.js (>= 18 recommended)
- npm (or yarn/pnpm if you prefer)

Quick start:

1. Install dependencies

```bash
npm install
```

2. Development server (hot reload):

```bash
npm run dev
```

3. Production build:

```bash
npm run build
```

4. Preview production build locally:

```bash
npm run preview
```

Notes:

- The PDF worker is imported via Vite (see `components/PdfReaderView.tsx`) to ensure `pdfjs-dist` uses the correct worker URL.
- EPUB features depend on `epub.js` loaded in the browser; ensure your browser environment allows the app to load the runtime.

## Testing & linting

Run the test suite:

```bash
npm run test
```

Current test coverage:
- OPDS 1 & 2 parsing
- Collection detection and organization
- Credential handling
- Book detail views
- Import flows

Recent test updates: additional OPDS2 unit tests were added to cover:
- Publications-only OPDS2 feeds (feeds that omit top-level metadata but contain publications)
- Registry navigation inference (treat navigation items with type `application/opds+json` as catalog entries so registries like Fulcrum show their catalogs correctly in the UI)

Linting:

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

Type checking:

```bash
npm run type-check         # Current baseline
npm run type-check:strict  # Stricter profile for migration
```

## Architecture (Phase 2 - Service Layer)

MeBooks now includes a comprehensive service layer with domain-driven architecture:

### Services Available

1. **BookRepository** (`domain/book`) - Book persistence with CRUD operations
2. **OPDS Services** (`domain/catalog`) - OPDS 1/2 parsing and acquisition resolution
3. **BookmarkService** (`domain/reader`) - Bookmark management and organization
4. **CitationService** (`domain/reader`) - Citations and bibliographic formatting (APA, MLA)
5. **PositionTracker** (`domain/reader`) - Reading position and progress tracking

### Key Features

- **Result Pattern**: Type-safe error handling without exceptions
- **Comprehensive Logging**: All operations tracked for debugging
- **Backward Compatible**: Services coexist with existing code
- **Full TypeScript**: Complete type safety and IntelliSense support
- **Easy Testing**: Simple to mock and test

### Documentation

- `PHASE_2_COMPLETE.md` - Complete Phase 2 summary and metrics
- `PHASE_2_MIGRATION_GUIDE.md` - Comprehensive migration patterns and examples
- `PHASE_2_PROGRESS.md` - Detailed progress tracking

See the migration guide for usage examples and best practices.

## Short changelog (this release)

### Palace Registry Integration (December 2025)
- ✅ Added automatic OPDS catalog import via URL parameters
- ✅ Support for `?import=<catalogUrl>&name=<catalogName>` launch parameters
- ✅ Toast notifications for import success/failure feedback
- ✅ Automatic navigation to library view after import
- ✅ URL parameter cleanup after processing
- ✅ Comprehensive test page and documentation

### Phase 2 - Service Layer (October 2025)
- ✅ Created 5 domain services (2,274 lines of code)
- ✅ Implemented Result pattern for type-safe error handling
- ✅ Added comprehensive logging to all domain operations
- ✅ Full backward compatibility maintained
- ✅ 89/89 tests passing
 - ✅ Full backward compatibility maintained
 - ✅ Tests updated and expanded for OPDS2 parsing and registry handling (current suite: 200 tests locally)
 - ✅ OPDS2 parsing: accept publications-only feeds and infer registry navigation items (type=application/opds+json) as terminal catalog entries so registries surface properly in the UI

### Previous Features
- Added EPUB font-size zoom and per-book persistence.
- Implemented a shared keyboard help modal with accessible focus trapping.
- Reworked PDF viewer to use `react-pdf` with bundle-friendly worker import and added PDF TOC mapping.
- Added a small HUD that displays zoom/font-size changes and custom tooltips in the help modal.

## OPDS2 PoC

This release includes a proof-of-concept OPDS2 client and a basic borrow flow for testing with catalogs that require Basic authentication (for example, small library demo servers like Palace Manager).

- The app can detect OPDS2 acquisition links with rel `http://opds-spec.org/acquisition/borrow` and will show a "Borrow" button in the Book Detail view.
- Borrowing is performed with a POST request to the provided borrow href. If the catalog requires Basic auth, the app will prompt for credentials and can persist them (localStorage) for convenience.
- This is a PoC: the current flow saves a metadata-only BookRecord into the local IndexedDB on successful borrow. Full acquisition download/import is a planned follow-up.

How to test the PoC locally:

1. Start the dev server: `npm run dev`.
2. Open the Library settings menu and use the "Add Palace OPDS2 Sample" quick-add entry to add a sample OPDS2 catalog used in tests.
3. Browse the catalog, open a borrowable entry, and click "Borrow". If the server requires Basic auth you will be prompted to enter credentials (optionally save them).
4. After a successful borrow the book metadata will appear in the library. Importing the full content is not yet automatic and requires the follow-up work described below.

Planned follow-ups:

- Implement acquisition handling (indirect acquisitions) and the download/import pipeline to convert borrow operations into saved EPUB/PDF content.
- Add caching/ETag support and robust error handling for OPDS2 fetches.
- Improve UI for managing stored OPDS credentials.

## Palace Registry Integration

MeBooks provides comprehensive integration support for registry viewer applications through cross-tab communication and a dedicated JavaScript library. This enables seamless catalog discovery and addition to existing user libraries without losing data or creating isolated instances.

### 🚀 MeBooks Integration Library

**Download**: [`mebooks-integration.js`](mebooks-integration.js)

A standalone JavaScript library that handles the complexity of integrating with MeBooks:

```javascript
// Initialize the integration library
const mebooksIntegration = new MeBooksIntegration('https://your-mebooks-domain.com/');

// Import a catalog - automatically detects existing instances
const result = await mebooksIntegration.importCatalog(catalogUrl, catalogName);

// Check if MeBooks is currently running
const isRunning = await mebooksIntegration.checkMeBooksRunning();
```

### 🔧 Integration Methods

**1. Cross-Tab Communication (Recommended)**
- Communicates with existing MeBooks instances via localStorage events
- Preserves user's existing library data and settings
- Provides instant feedback and error handling
- No popup blockers or new tab issues

**2. URL Parameters (Fallback)**
- Opens new MeBooks instance when no existing one is detected
- URL format: `https://your-domain.com/#/?import=<catalogUrl>&name=<catalogName>`

### 📋 Quick Integration Guide

#### For Registry Applications:

1. **Include the Library**:
   ```html
   <script src="https://your-mebooks-domain.com/mebooks-integration.js"></script>
   ```

2. **Initialize**:
   ```javascript
   const mebooksIntegration = new MeBooksIntegration('https://your-mebooks-domain.com/');
   ```

3. **Add Catalog Integration**:
   ```javascript
   async function addToMeBooks(catalogUrl, catalogName) {
       try {
           const result = await mebooksIntegration.importCatalog(catalogUrl, catalogName);

           if (result.success) {
               console.log(`✅ ${result.message}`);
               // Show success UI
           } else {
               console.error(`❌ ${result.message}`);
               // Show error UI
           }
       } catch (error) {
           console.error('Integration failed:', error);
       }
   }
   ```

4. **Add to Your UI**:
   ```html
   <button onclick="addToMeBooks('https://example.com/opds', 'Example Catalog')">
       Add to MeBooks
   </button>
   ```

### 🎯 Library API Reference

#### `new MeBooksIntegration(mebooksBaseUrl)`
- **mebooksBaseUrl**: Base URL of your MeBooks instance

#### `importCatalog(catalogUrl, catalogName, options)`
- **catalogUrl**: OPDS catalog URL to import
- **catalogName**: Display name for the catalog
- **options**: Configuration object
  - `sameTab`: Open in same tab instead of new tab (default: false)
  - `focusExisting`: Focus existing MeBooks tab if found (default: true)
- **Returns**: Promise resolving to `{success: boolean, method: string, message: string}`

#### `checkMeBooksRunning()`
- **Returns**: Promise resolving to boolean indicating if MeBooks is running

#### `setResponseTimeout(timeout)`
- **timeout**: Milliseconds to wait for existing instance response (500-5000ms)

### 🧪 Testing & Development

**Live Test Page**: Visit `/test-registry-integration.html` on your MeBooks instance
**Example Registry App**: See `/example-registry-app.html` for a complete registry implementation

**Test Scenarios**:
1. **Existing Instance**: MeBooks already open - catalog added via cross-tab communication
2. **No Instance**: MeBooks not open - new instance launched with catalog
3. **Status Detection**: Check if MeBooks is currently running

### 🔍 Integration Examples

**React Component**:
```jsx
import React, { useState } from 'react';

const CatalogCard = ({ catalog }) => {
    const [status, setStatus] = useState('');
    const mebooksIntegration = new MeBooksIntegration('https://your-mebooks-domain.com/');

    const handleAddToMeBooks = async () => {
        setStatus('Adding catalog...');
        try {
            const result = await mebooksIntegration.importCatalog(
                catalog.opdsUrl,
                catalog.name
            );
            setStatus(result.success ? '✅ Added successfully!' : '❌ Failed to add');
        } catch (error) {
            setStatus('❌ Error occurred');
        }
    };

    return (
        <div className="catalog-card">
            <h3>{catalog.name}</h3>
            <button onClick={handleAddToMeBooks}>Add to MeBooks</button>
            {status && <p>{status}</p>}
        </div>
    );
};
```

**Vanilla JavaScript**:
```javascript
class RegistryApp {
    constructor() {
        this.mebooks = new MeBooksIntegration('https://your-mebooks-domain.com/');
    }

    async addCatalogToMeBooks(catalogElement) {
        const url = catalogElement.dataset.opdsUrl;
        const name = catalogElement.dataset.name;
        const statusEl = catalogElement.querySelector('.status');

        statusEl.textContent = 'Adding to MeBooks...';

        const result = await this.mebooks.importCatalog(url, name);
        statusEl.textContent = result.success ?
            '✅ Added to MeBooks!' :
            '❌ Failed to add';
    }
}
```

### 🔗 Cross-Tab Communication Protocol

For advanced integrations, you can implement the protocol directly:

**Import Request**:
```javascript
localStorage.setItem('mebooks-import-catalog', JSON.stringify({
    importUrl: catalogUrl,
    catalogName: catalogName,
    timestamp: Date.now()
}));
```

**Response Listening**:
```javascript
window.addEventListener('storage', (event) => {
    if (event.key === 'mebooks-import-response' && event.newValue) {
        const response = JSON.parse(event.newValue);
        console.log('Import result:', response.success);
    }
});
```

### 📁 Repository Files

- `mebooks-integration.js` - Integration library
- `test-registry-integration.html` - Live test page
- `example-registry-app.html` - Complete example registry application
- `REGISTRY_INTEGRATION_IMPLEMENTATION.md` - Technical implementation details

### Testing

A test page is included at `/test-registry-integration.html` with sample OPDS catalogs for testing the integration functionality.

For detailed implementation information, see `REGISTRY_INTEGRATION_IMPLEMENTATION.md`.

## Contributing

Contributions welcome. Open an issue or submit a PR with a short description of the change. For larger work, create a feature branch and open a PR when ready.

## License

This repository does not currently include a license file. Consider adding an appropriate open-source license if you plan to publish the project.

## Release

This README was updated as part of the v1.0.0 release tagging in this repository. See the Git tags for release history.

## OPDS2 Feed Parsing

If an OPDS2 feed is missing required metadata or publications, the parser will log a warning but will not throw an error. The UI will remain optional and will not crash or break. This allows the app to gracefully handle incomplete or minimal feeds.
