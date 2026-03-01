import React from 'react';

import { LeftArrowIcon } from './icons';

interface AboutPageProps {
  onBack: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  return (
    <div className="theme-text-primary container mx-auto min-h-screen p-4 md:p-8">
      <header className="mb-8">
        <button onClick={onBack} className="theme-text-secondary inline-flex items-center gap-2 transition-colors hover:text-sky-400">
          <LeftArrowIcon className="w-5 h-5" />
          <span>Back to Library</span>
        </button>
      </header>

      <main className="max-w-4xl mx-auto space-y-8">
        <section className="theme-surface-elevated theme-border rounded-xl border p-6 shadow-lg">
          <h1 className="text-3xl font-bold text-sky-300 mb-2">About MeBooks</h1>
          <p className="theme-text-secondary mb-4 text-lg">
            <span className="font-semibold text-sky-200">MeBooks</span> is a modern, browser-based ebook reader inspired by the user experience of Readium's Thorium, but built entirely with web technologies. EPUB books are rendered using <span className="font-semibold">epub.js</span>, and PDF books are rendered using an embedded distribution of <span className="font-semibold">pdf.js</span> via <span className="font-semibold">react-pdf</span> and <span className="font-semibold">pdfjs-dist</span>. Import EPUB and PDF books into your local library, or browse and download from online OPDS catalogs. Built with accessibility, privacy, and customization in mind.
          </p>
        </section>

        {/* For Developers section moved directly after Technology Stack */}

        <section className="grid md:grid-cols-2 gap-6">
          <div className="theme-surface-elevated theme-border flex flex-col gap-2 rounded-xl border p-6 shadow">
            <h2 className="text-xl font-semibold text-sky-300 flex items-center gap-2 mb-2">Accessibility & A11Y
              <span className="bg-sky-900 text-sky-200 text-xs font-bold px-2 py-1 rounded ml-2">WCAG 2.1 AA</span>
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
              <a href="/JamesEnglish1028-My-Ebook-Reader/VPAT.html" target="_blank" rel="noopener noreferrer" className="block bg-sky-900/80 border border-sky-700 rounded px-4 py-2 text-sky-300 font-semibold text-center hover:bg-sky-800 transition">Accessibility VPAT (Voluntary Product Accessibility Template)</a>
            </div>
          </div>
          <div className="theme-surface-elevated theme-border flex flex-col gap-2 rounded-xl border p-6 shadow">
            <h2 className="text-xl font-semibold text-sky-300 mb-2">Library Management</h2>
            <ul className="theme-text-secondary list-inside list-disc space-y-1">
              <li><span className="font-semibold">Local-First Storage:</span> Your books and reading data never leave your computer. Book files are stored in IndexedDB, settings and annotations in LocalStorage.</li>
              <li><span className="font-semibold">EPUB & PDF Import:</span> Build your personal library with <code>.epub</code> and <code>.pdf</code> files.</li>
              <li><span className="font-semibold">Book Details:</span> View publication info, subjects, and provider IDs.</li>
              <li><span className="font-semibold">Library Organization:</span> Sort by title, author, publication date, or date added.</li>
            </ul>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="theme-surface-elevated theme-border flex flex-col gap-2 rounded-xl border p-6 shadow">
            <h2 className="text-xl font-semibold text-sky-300 mb-2">Online Catalogs (OPDS)</h2>
            <ul className="theme-text-secondary list-inside list-disc space-y-1">
              <li><span className="font-semibold">Browse Remote Libraries:</span> Add and manage unlimited public OPDS catalogs.</li>
              <li><span className="font-semibold">OPDS v1 & v2 Support:</span> Compatible with XML (Atom) and JSON feeds.</li>
              <li><span className="font-semibold">One-Click Import:</span> Download books directly from catalogs to your library.</li>
            </ul>
          </div>
          <div className="theme-surface-elevated theme-border flex flex-col gap-2 rounded-xl border p-6 shadow">
            <h2 className="text-xl font-semibold text-sky-300 mb-2">Advanced Reader Experience</h2>
            <ul className="theme-text-secondary list-inside list-disc space-y-1">
              <li><span className="font-semibold">Browser-Based:</span> No installation needed—runs entirely in your browser.</li>
              <li><span className="font-semibold">Multi-Format Support:</span> Read EPUB files with <span className="font-semibold">epub.js</span> and PDF files with an embedded <span className="font-semibold">pdf.js</span> engine (<span className="font-semibold">react-pdf</span> + <span className="font-semibold">pdfjs-dist</span>).</li>
              <li><span className="font-semibold">Advanced Navigation:</span> Both readers support table of contents navigation, page jumping, and keyboard shortcuts for moving between chapters or pages.</li>
              <li><span className="font-semibold">Full-Text Search:</span> EPUB and PDF readers both support searching the entire book text, with results highlighted and easy navigation between matches.</li>
              <li><span className="font-semibold">Customizable Reader (EPUB):</span> Adjust font, theme, and reading mode (paginated or scrolled).</li>
              <li><span className="font-semibold">Rich Tools (EPUB):</span> Bookmarks with notes, academic citation generation, and full-text search.</li>
              <li><span className="font-semibold">Citation Export (EPUB):</span> Export citations in <code>.ris</code> format for Zotero/EndNote.</li>
              <li><span className="font-semibold">Read Aloud (EPUB):</span> Text-to-speech with synchronized highlighting.</li>
            </ul>
          </div>
        </section>

        <section className="theme-surface-elevated theme-border rounded-xl border p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-sky-300 mb-2">Technology Stack</h2>
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
          <h2 className="text-xl font-semibold text-sky-300 mb-2">For Developers</h2>
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
