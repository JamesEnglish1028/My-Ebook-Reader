import React from 'react';

import type { AudienceMode, AvailabilityMode, DistributorMode, FictionMode, MediaMode, PublicationMode } from '../../../types';

interface FilterOption<T> {
  key: T;
  label: string;
  available: boolean;
}

interface CatalogFiltersProps {
  /** Available audience modes */
  availableAudiences: string[];
  /** Available fiction modes */
  availableFictionModes: string[];
  /** Available media modes */
  availableMediaModes: string[];
  /** Available publication types */
  availablePublicationTypes: Array<{ key: PublicationMode; label: string }>;
  /** Available availability states */
  availableAvailabilityModes: Array<{ key: AvailabilityMode; label: string }>;
  /** Available distributors */
  availableDistributors: DistributorMode[];
  /** Current audience filter */
  audienceMode: AudienceMode;
  /** Current fiction filter */
  fictionMode: FictionMode;
  /** Current media filter */
  mediaMode: MediaMode;
  /** Current publication filter */
  publicationMode: PublicationMode;
  /** Current availability filter */
  availabilityMode: AvailabilityMode;
  /** Current distributor filter */
  distributorMode: DistributorMode;
  /** Callback for audience filter change */
  onAudienceChange: (mode: AudienceMode) => void;
  /** Callback for fiction filter change */
  onFictionChange: (mode: FictionMode) => void;
  /** Callback for media filter change */
  onMediaChange: (mode: MediaMode) => void;
  /** Callback for publication filter change */
  onPublicationChange: (mode: PublicationMode) => void;
  /** Callback for availability filter change */
  onAvailabilityChange: (mode: AvailabilityMode) => void;
  /** Callback for distributor filter change */
  onDistributorChange: (mode: DistributorMode) => void;
}

/**
 * CatalogFilters - Filter controls for OPDS catalog browsing
 *
 * Provides genre category navigation and audience/fiction/media filters.
 * Only displays filters that have multiple available options.
 */
const CatalogFilters: React.FC<CatalogFiltersProps> = ({
  availableAudiences,
  availableFictionModes,
  availableMediaModes,
  availablePublicationTypes,
  availableAvailabilityModes,
  availableDistributors,
  audienceMode,
  fictionMode,
  mediaMode,
  publicationMode,
  availabilityMode,
  distributorMode,
  onAudienceChange,
  onFictionChange,
  onMediaChange,
  onPublicationChange,
  onAvailabilityChange,
  onDistributorChange,
}) => {
  // Build filter options with availability
  const audienceOptions: FilterOption<AudienceMode>[] = [
    { key: 'all', label: 'All Ages', available: true },
    { key: 'adult', label: 'Adult', available: availableAudiences.includes('adult') },
    { key: 'young-adult', label: 'Young Adult', available: availableAudiences.includes('young-adult') },
    { key: 'children', label: 'Children', available: availableAudiences.includes('children') },
  ];

  const fictionOptions: FilterOption<FictionMode>[] = [
    { key: 'all', label: 'All Types', available: true },
    { key: 'fiction', label: 'Fiction', available: availableFictionModes.includes('fiction') },
    { key: 'non-fiction', label: 'Non-Fiction', available: availableFictionModes.includes('non-fiction') },
  ];

  const mediaOptions: FilterOption<MediaMode>[] = [
    { key: 'all', label: 'All Media', available: true },
    { key: 'epub', label: 'EPUB', available: availableMediaModes.includes('epub') },
    { key: 'pdf', label: 'PDF', available: availableMediaModes.includes('pdf') },
    { key: 'audiobook', label: 'Audiobooks', available: availableMediaModes.includes('audiobook') },
  ];

  // Check if any filters should be displayed
  const showAudienceFilter = availableAudiences.length > 1;
  const showFictionFilter = availableFictionModes.length > 1;
  const showMediaFilter = availableMediaModes.length > 1;
  const showPublicationFilter = availablePublicationTypes.length > 1;
  const showAvailabilityFilter = availableAvailabilityModes.length > 1;
  const showDistributorFilter = availableDistributors.length > 1;

  const showAnyFilters = showAudienceFilter || showFictionFilter || showMediaFilter || showPublicationFilter || showAvailabilityFilter || showDistributorFilter;

  if (!showAnyFilters) {
    return null;
  }

  const activeFilterCount = Number(audienceMode !== 'all')
    + Number(fictionMode !== 'all')
    + Number(mediaMode !== 'all')
    + Number(publicationMode !== 'all')
    + Number(availabilityMode !== 'all')
    + Number(distributorMode !== 'all');

  return (
    <div className="mb-5 rounded-xl border border-slate-700/60 bg-slate-900/35 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Filters</h3>
        <span className="text-[11px] text-slate-500">
          {activeFilterCount > 0 ? `${activeFilterCount} active` : 'Local only'}
        </span>
      </div>
      {(showAudienceFilter || showFictionFilter || showMediaFilter || showPublicationFilter || showAvailabilityFilter || showDistributorFilter) && (
        <div className="flex flex-wrap items-start gap-3">
          {showAudienceFilter && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Audience</span>
              <div className="flex flex-wrap gap-1.5">
                {audienceOptions
                  .filter((option) => option.available)
                  .map((option) => (
                    <button
                      key={option.key}
                      onClick={() => onAudienceChange(option.key)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${audienceMode === option.key
                        ? 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {option.label.replace('All Ages', 'All')}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {showFictionFilter && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Type</span>
              <div className="flex flex-wrap gap-1.5">
                {fictionOptions
                  .filter((option) => option.available)
                  .map((option) => (
                    <button
                      key={option.key}
                      onClick={() => onFictionChange(option.key)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${fictionMode === option.key
                        ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {option.label.replace('All Types', 'All')}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {showMediaFilter && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Format</span>
              <div className="flex flex-wrap gap-1.5">
                {mediaOptions
                  .filter((option) => option.available)
                  .map((option) => (
                    <button
                      key={option.key}
                      onClick={() => onMediaChange(option.key)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${mediaMode === option.key
                        ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {option.label.replace('All Media', 'All')}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {showPublicationFilter && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Publication</span>
              <div className="flex flex-wrap gap-1.5">
                {[{ key: 'all' as PublicationMode, label: 'All' }, ...availablePublicationTypes]
                  .map((option) => (
                    <button
                      key={option.key}
                      onClick={() => onPublicationChange(option.key)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${publicationMode === option.key
                        ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {showAvailabilityFilter && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Availability</span>
              <div className="flex flex-wrap gap-1.5">
                {[{ key: 'all' as AvailabilityMode, label: 'All' }, ...availableAvailabilityModes]
                  .map((option) => (
                    <button
                      key={option.key}
                      onClick={() => onAvailabilityChange(option.key)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${availabilityMode === option.key
                        ? 'bg-lime-500/20 text-lime-100 ring-1 ring-lime-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {showDistributorFilter && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Distributor</span>
              <div className="flex flex-wrap gap-1.5">
                {['all', ...availableDistributors]
                  .map((option) => (
                    <button
                      key={option}
                      onClick={() => onDistributorChange(option as DistributorMode)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${distributorMode === option
                        ? 'bg-fuchsia-500/20 text-fuchsia-100 ring-1 ring-fuchsia-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {option === 'all' ? 'All' : option}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CatalogFilters;
