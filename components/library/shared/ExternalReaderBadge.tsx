import React from 'react';

import type { ExternalReaderApp } from '../../../domain/book/types';

import { getExternalReaderBadgeLabel } from './externalReader';

interface ExternalReaderBadgeProps {
  app?: ExternalReaderApp;
  className?: string;
}

const ExternalReaderBadge: React.FC<ExternalReaderBadgeProps> = ({ app, className = '' }) => {
  const label = getExternalReaderBadgeLabel(app);

  if (!label) {
    return null;
  }

  return (
    <span className={`theme-accent-badge inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`.trim()}>
      {label}
    </span>
  );
};

export default ExternalReaderBadge;
