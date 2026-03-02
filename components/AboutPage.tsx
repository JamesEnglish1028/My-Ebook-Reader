import React from 'react';

import { LeftArrowIcon } from './icons';

interface AboutPageProps {
  onBack: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  return (
    <div className="theme-text-primary container mx-auto min-h-screen p-4 md:p-8">
      <header className="mb-8">
        <button onClick={onBack} className="theme-text-secondary theme-accent-text-emphasis-hover inline-flex items-center gap-2 transition-colors">
          <LeftArrowIcon className="w-5 h-5" />
          <span>Back to Library</span>
        </button>
      </header>

      <main className="max-w-4xl mx-auto space-y-8">
        <section className="theme-surface-elevated theme-border rounded-xl border p-6 shadow-lg">
          <h1 className="theme-accent-text-emphasis mb-2 text-3xl font-bold">About MeBooks</h1>
          <p className="theme-text-secondary mb-4 text-lg">
            <span className="theme-accent-text font-semibold">MeBooks</span> is a local-first, browser-based reading app for EPUB, PDF, and audiobook content. EPUB books are rendered using <span className="font-semibold">epub.js</span>, PDF books use <span className="font-semibold">react-pdf</span> and <span className="font-semibold">pdfjs-dist</span>, and audiobook playback supports manifest-based track loading with authenticated refresh. Build a personal shelf from local files, browse OPDS catalogs, and keep your reading data on your device unless you explicitly sync it.
          </p>
        </section>

        {/* For Developers section moved directly after Technology Stack */}

        <section className="grid md:grid-cols-2 gap-6">
          <div className="theme-surface-elevated theme-border flex flex-col gap-2 rounded-xl border p-6 shadow">
            <h2 className="theme-accent-text-emphasis mb-2 flex items-center gap-2 text-xl font-semibold">Accessibility & A11Y
              <span className="theme-accent-badge ml-2 rounded border px-2 py-1 text-xs font-bold">WCAG 2.1 AA</span>
            </h2>
            <ul className="theme-text-secondary list-inside list-disc space-y-1">
              <li><span className="font-semibold">Keyboard Navigation:</span> Logical tab order, visible focus, and full keyboard support.</li>
              <li><span className="font-semibold">Screen Reader Support:</span> ARIA labels, live regions, and dynamic announcements.</li>
              <li><span className="font-semibold">High Contrast & Color Blind Friendly:</span> Tested palette and contrast ratios.</li>
              <li><span className="font-semibold">Skip Links & Landmarks:</span> Quick navigation for assistive tech users.</li>
              <li><span className="font-semibold">Accessible Modals & Dialogs:</span> Focus management, ARIA roles, and announcements.</li>
              <li><span className="font-semibold">Global Keyboard Shortcuts:</span> Discoverable, accessible shortcuts for power users.</li>
              <li><span className="font-semibold">Adjustable Font Size & Family:</span> Reader settings for easy text customization.</li>
              <li><span className="font-semibold">Responsive Design:</span> Works on all devices and screen sizes.</li>
            </ul>
            <div className="mt-3">
              <a href="/JamesEnglish1028-My-Ebook-Reader/VPAT.html" target="_blank" rel="noopener noreferrer" className="theme-accent-surface theme-accent-text-emphasis block rounded border px-4 py-2 text-center font-semibold transition hover:opacity-90">Accessibility VPAT (Voluntary Product Accessibility Template)</a>
            </div>
          </div>
          <div className="theme-surface-elevated theme-border flex flex-col gap-2 rounded-xl border p-6 shadow">
            <h2 className="theme-accent-text-emphasis mb-2 text-xl font-semibold">Library Management</h2>
            <ul className="theme-text-secondary list-inside list-disc space-y-1">
              <li><span className="font-semibold">Local-First Storage:</span> Your shelf and reading data stay in IndexedDB and LocalStorage on this device by default.</li>
              <li><span className="font-semibold">My Shelf Views:</span> Switch between grid and inline layouts, filter by format or provider, and group local titles by provider.</li>
              <li><span className="font-semibold">Local Upload Labeling:</span> Files imported from your machine are clearly marked as <code>Local Upload</code>.</li>
              <li><span className="font-semibold">Book Details:</span> View publication info, provider IDs, access state, and item-specific actions from a dedicated detail page.</li>
            </ul>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="theme-surface-elevated theme-border flex flex-col gap-2 rounded-xl border p-6 shadow">
            <h2 className="theme-accent-text-emphasis mb-2 text-xl font-semibold">Online Catalogs (OPDS)</h2>
            <ul className="theme-text-secondary list-inside list-disc space-y-1">
              <li><span className="font-semibold">Browse Remote Libraries:</span> Add and manage unlimited public OPDS catalogs.</li>
              <li><span className="font-semibold">OPDS v1 & v2 Support:</span> Compatible with XML (Atom) and JSON feeds.</li>
              <li><span className="font-semibold">One-Click Import:</span> Download supported books directly from catalogs to your shelf.</li>
              <li><span className="font-semibold">Protected Content Handling:</span> Readium LCP and Adobe DRM titles are identified and blocked before import.</li>
              <li><span className="font-semibold">Shelf Awareness:</span> Loan items already imported are badged and the import action is disabled.</li>
            </ul>
          </div>
          <div className="theme-surface-elevated theme-border flex flex-col gap-2 rounded-xl border p-6 shadow">
            <h2 className="theme-accent-text-emphasis mb-2 text-xl font-semibold">Advanced Reader Experience</h2>
            <ul className="theme-text-secondary list-inside list-disc space-y-1">
              <li><span className="font-semibold">Browser-Based:</span> No installation needed—runs entirely in your browser.</li>
              <li><span className="font-semibold">Multi-Format Support:</span> Read EPUB, PDF, and audiobook content from one app.</li>
              <li><span className="font-semibold">Advanced Navigation:</span> EPUB and PDF readers support contents panels, search, bookmarks, citations, page/location controls, and keyboard shortcuts.</li>
              <li><span className="font-semibold">Customizable Reading:</span> Adjust EPUB display, read-aloud settings, PDF zoom/fit, and app-wide UI theme.</li>
              <li><span className="font-semibold">Audiobook Playback:</span> Track-based playback with contents, per-track progress, saved resume position, and token refresh for authenticated loans.</li>
              <li><span className="font-semibold">Citation Export:</span> Export citations in <code>.ris</code> format for Zotero/EndNote.</li>
            </ul>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="theme-surface-elevated theme-border flex flex-col gap-2 rounded-xl border p-6 shadow">
            <h2 className="theme-accent-text-emphasis mb-2 text-xl font-semibold">Sync & Backup</h2>
            <ul className="theme-text-secondary list-inside list-disc space-y-1">
              <li><span className="font-semibold">Google Drive Sync:</span> Create timestamped restore points and restore your shelf metadata across devices.</li>
              <li><span className="font-semibold">Protected Loan Safety:</span> Authenticated catalog EPUB/PDF items can sync as records without uploading protected file content.</li>
              <li><span className="font-semibold">Clear Recovery:</span> Metadata-only restored protected titles are preserved and clearly marked for re-download.</li>
            </ul>
          </div>
          <div className="theme-surface-elevated theme-border flex flex-col gap-2 rounded-xl border p-6 shadow">
            <h2 className="theme-accent-text-emphasis mb-2 text-xl font-semibold">Accessibility & Resilience</h2>
            <ul className="theme-text-secondary list-inside list-disc space-y-1">
              <li><span className="font-semibold">Focus Management:</span> Reader panels and modals trap focus and expose clear keyboard paths.</li>
              <li><span className="font-semibold">High-Contrast Theming:</span> Shared theme tokens keep controls readable in light and dark mode.</li>
              <li><span className="font-semibold">Safer Upgrades:</span> Stale lazy-loaded asset failures now trigger a one-time automatic reload instead of leaving the app stuck.</li>
            </ul>
          </div>
        </section>

        <section className="theme-surface-elevated theme-border rounded-xl border p-6 shadow-lg">
          <h2 className="theme-accent-text-emphasis mb-2 text-xl font-semibold">Technology Stack</h2>
          <ul className="theme-text-secondary list-inside list-disc space-y-1">
            <li><span className="font-semibold">React:</span> Component-based UI library.</li>
            <li><span className="font-semibold">TypeScript:</span> Static typing for maintainable code.</li>
            <li><span className="font-semibold">TailwindCSS:</span> Utility-first CSS for rapid styling.</li>
            <li><span className="font-semibold">epub.js:</span> EPUB parsing and rendering.</li>
            <li><span className="font-semibold">pdf.js:</span> PDF rendering (via <span className="font-semibold">react-pdf</span> and <span className="font-semibold">pdfjs-dist</span>).</li>
            <li><span className="font-semibold">JSZip:</span> EPUB unzipping (via <code>epub.js</code>).</li>
          </ul>
          <p className="theme-text-muted mt-2">All external dependencies are loaded from a CDN for simplicity.</p>
        </section>

        <section className="theme-surface-elevated theme-border mt-8 rounded-xl border p-6 shadow-lg">
          <h2 className="theme-accent-text-emphasis mb-2 text-xl font-semibold">For Developers</h2>
          <ul className="theme-text-secondary list-inside list-disc space-y-1">
            <li><span className="font-semibold">Vite:</span> Lightning-fast build tool and dev server for modern web apps.</li>
            <li><span className="font-semibold">React Router:</span> Declarative routing for SPA navigation.</li>
            <li><span className="font-semibold">React-PDF:</span> PDF rendering in React using pdf.js.</li>
            <li><span className="font-semibold">TanStack Query:</span> Powerful data fetching and caching (if used).</li>
            <li><span className="font-semibold">Other modern libraries:</span> Includes utility packages and accessibility helpers as needed.</li>
          </ul>
          <p className="theme-text-muted mt-2">See the <code>package.json</code> for a full list of dependencies and scripts.</p>
        </section>
      </main>
    </div>
  );
};

export default AboutPage;
