import type { ExternalReaderApp } from '../../../domain/book/types';

export type ReaderDestination = ExternalReaderApp | 'mebooks';

export const getReaderDestination = (externalReaderApp?: ExternalReaderApp): ReaderDestination => {
  if (externalReaderApp === 'palace') return 'palace';
  if (externalReaderApp === 'thorium') return 'thorium';
  return 'mebooks';
};

export const getReaderLabel = (reader: ReaderDestination): string => {
  if (reader === 'palace') return 'Read in Palace';
  if (reader === 'thorium') return 'Read in Thorium';
  return 'Read Here';
};

export const getExternalReaderBadgeLabel = (externalReaderApp?: ExternalReaderApp): string | null => {
  if (externalReaderApp === 'palace') return 'Palace';
  if (externalReaderApp === 'thorium') return 'Thorium';
  return null;
};

export const getPalaceLogoSrc = (): string => `${import.meta.env.BASE_URL}palace-logo.svg`;
