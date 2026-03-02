import React from 'react';

import type { BookMetadata, CatalogBook } from '../../../types';

interface AccessibilityBadgesProps {
  book: BookMetadata | CatalogBook;
  className?: string;
}

const accessibilityFeatureLabels: Record<string, string> = {
  altText: 'Alternative Text',
  alternativeText: 'Alternative Text',
  annotations: 'Annotations',
  audioDescription: 'Audio Description',
  bookmarks: 'Bookmarks',
  braille: 'Braille',
  captions: 'Captions',
  chapterNavigation: 'Chapter Navigation',
  displayTransformability: 'Display Transformability',
  dyslexiaFriendlyFont: 'Dyslexia Friendly Font',
  largeFont: 'Large Font',
  longDescription: 'Long Description',
  MathML: 'MathML',
  pageBreakMarkers: 'Page Break Markers',
  printPageNumbers: 'Print Page Numbers',
  readingOrder: 'Reading Order',
  reduceMotion: 'Reduce Motion',
  resizeText: 'Resize Text',
  structuralNavigation: 'Structural Navigation',
  tableOfContents: 'Table of Contents',
  transcript: 'Transcript',
  transcription: 'Transcription',
};

const accessModeLabels: Record<string, string> = {
  auditory: 'Auditory',
  chartOnVisual: 'Charts and Visuals',
  textual: 'Text',
  tactile: 'Tactile',
  visual: 'Visual',
};

const hazardLabels: Record<string, string> = {
  flashing: 'Flashing Content',
  motionSimulation: 'Motion Simulation',
  noFlashingHazard: 'No Flashing Hazard',
  noMotionSimulationHazard: 'No Motion Simulation Hazard',
  noSoundHazard: 'No Sound Hazard',
  none: 'No Known Hazards',
  sound: 'Sound Hazard',
  unknown: 'Hazards Not Specified',
};

const certificationLabels: Record<string, string> = {
  WCAG2A: 'WCAG 2.0 A',
  WCAG2AA: 'WCAG 2.0 AA',
  WCAG2AAA: 'WCAG 2.0 AAA',
  'WCAG2.2A': 'WCAG 2.2 A',
  'WCAG2.2AA': 'WCAG 2.2 AA',
  'WCAG2.2AAA': 'WCAG 2.2 AAA',
  WCAG21A: 'WCAG 2.1 A',
  WCAG21AA: 'WCAG 2.1 AA',
  WCAG21AAA: 'WCAG 2.1 AAA',
  WCAG22A: 'WCAG 2.2 A',
  WCAG22AA: 'WCAG 2.2 AA',
  WCAG22AAA: 'WCAG 2.2 AAA',
};

const toDisplayLabel = (value: string, labels: Record<string, string>): string => {
  if (labels[value]) {
    return labels[value];
  }

  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const renderPillGroup = (
  title: string,
  values: string[],
  labels: Record<string, string>,
  useInfoTone = false,
) => {
  if (values.length === 0) {
    return null;
  }

  const pillClassName = useInfoTone
    ? 'theme-info'
    : 'theme-surface-muted theme-text-secondary';

  return (
    <div className="space-y-2">
      <p className="theme-text-primary text-xs font-semibold uppercase tracking-[0.14em]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={`${title}-${value}`}
            className={`${pillClassName} inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium`}
            title={toDisplayLabel(value, labels)}
          >
            {toDisplayLabel(value, labels)}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * AccessibilityBadges
 *
 * Displays flattened accessibility metadata from book records and catalog items
 * in a compact, scannable layout for the detail view.
 */
const AccessibilityBadges: React.FC<AccessibilityBadgesProps> = ({ book, className = '' }) => {
  const bookAny = book as BookMetadata & {
    accessModes?: string[];
    accessModesSufficient?: string[];
    accessibilityFeatures?: string[];
    hazards?: string[];
    accessibilitySummary?: string;
    certificationConformsTo?: string[];
    certification?: string;
    accessibilityFeedback?: string;
  };

  const features = Array.isArray(bookAny.accessibilityFeatures) ? bookAny.accessibilityFeatures.filter(Boolean) : [];
  const accessModes = Array.isArray(bookAny.accessModes) ? bookAny.accessModes.filter(Boolean) : [];
  const sufficientModes = Array.isArray(bookAny.accessModesSufficient) ? bookAny.accessModesSufficient.filter(Boolean) : [];
  const hazards = Array.isArray(bookAny.hazards) ? bookAny.hazards.filter(Boolean) : [];
  const certificationConformsTo = Array.isArray(bookAny.certificationConformsTo)
    ? bookAny.certificationConformsTo.filter(Boolean)
    : [];
  const summary = typeof bookAny.accessibilitySummary === 'string' ? bookAny.accessibilitySummary : '';
  const certification = typeof bookAny.certification === 'string' ? bookAny.certification : '';
  const feedback = typeof bookAny.accessibilityFeedback === 'string' ? bookAny.accessibilityFeedback : '';

  const hasAccessibilityMetadata = (
    features.length > 0
    || accessModes.length > 0
    || sufficientModes.length > 0
    || hazards.length > 0
    || certificationConformsTo.length > 0
    || !!summary
    || !!certification
    || !!feedback
  );

  if (!hasAccessibilityMetadata) {
    return null;
  }

  return (
    <section className={`theme-border theme-surface rounded-lg border p-4 ${className}`} aria-label="Accessibility details">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="theme-text-primary text-sm font-semibold">Accessibility</h4>
          <span className="theme-accent-badge inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
            Metadata
          </span>
        </div>

        {summary && (
          <div className="space-y-1">
            <p className="theme-text-primary text-xs font-semibold uppercase tracking-[0.14em]">Summary</p>
            <p className="theme-text-secondary text-sm leading-6">{summary}</p>
          </div>
        )}

        {renderPillGroup('Features', features, accessibilityFeatureLabels)}
        {renderPillGroup('Access Modes', accessModes, accessModeLabels)}
        {renderPillGroup('Sufficient Modes', sufficientModes, accessModeLabels)}
        {renderPillGroup('Hazards', hazards, hazardLabels, true)}
        {renderPillGroup('Standards', certificationConformsTo, certificationLabels)}

        {certification && (
          <div className="space-y-1">
            <p className="theme-text-primary text-xs font-semibold uppercase tracking-[0.14em]">Certification</p>
            <p className="theme-text-secondary text-sm">{certification}</p>
          </div>
        )}

        {feedback && (
          <div className="space-y-1">
            <p className="theme-text-primary text-xs font-semibold uppercase tracking-[0.14em]">Notes</p>
            <p className="theme-text-secondary text-sm leading-6">{feedback}</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default AccessibilityBadges;
