
// @vitest-environment jsdom
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BookDetailView from '../BookDetailView';

describe('BookDetailView accessibility rendering', () => {
  it('renders all accessibility metadata fields', () => {
    const book = {
      id: 1,
      title: 'Test Book',
      author: 'Author',
      coverImage: null,
      accessibilityFeatures: ['altText', 'displayTransformability'],
      accessModes: ['textual'],
      accessModesSufficient: ['textual'],
      hazards: ['none'],
      accessibilitySummary: 'Summary',
      certificationConformsTo: ['WCAG2.2AA'],
      certification: 'Certified',
      accessibilityFeedback: 'Feedback',
      language: 'en',
      rights: 'public domain',
      subjects: [],
      format: 'EPUB',
    };
    // Provide all required props and mocks
    const props = {
      book,
      source: 'library',
      catalogName: undefined,
      onBack: () => {},
      onReadBook: () => {},
      onImportFromCatalog: async () => ({ success: true }),
      importStatus: { isLoading: false, message: '', error: null },
      setImportStatus: () => {},
    };
    render(<BookDetailView {...props} />);

    expect(screen.getByRole('heading', { name: 'Accessibility' })).toBeInTheDocument();
    expect(screen.getAllByText('Summary').length).toBeGreaterThan(0);
    expect(screen.getByText('Alternative Text')).toBeInTheDocument();
    expect(screen.getByText('Display Transformability')).toBeInTheDocument();
    expect(screen.getByText('Access Modes')).toBeInTheDocument();
    expect(screen.getAllByText('Text').length).toBeGreaterThan(0);
    expect(screen.getByText('Hazards')).toBeInTheDocument();
    expect(screen.getByText('No Known Hazards')).toBeInTheDocument();
    expect(screen.getByText('Standards')).toBeInTheDocument();
    expect(screen.getByText('WCAG 2.2 AA')).toBeInTheDocument();
    expect(screen.getByText('Certification')).toBeInTheDocument();
    expect(screen.getByText('Certified')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });
});
