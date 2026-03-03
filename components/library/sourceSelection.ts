import { CATALOG_PRESETS, REGISTRY_PRESETS } from '../../constants/opdsPresets';

export const COMMUNITY_CATALOG_NAMES = new Set([
  'OAPEN',
  'Open Research Library',
  'PressBooks',
  'Project Gutenberg',
  'UPLOpen',
]);

export const normalizeSourceUrl = (value: string): string => value.trim().replace(/\/+$/, '').toLowerCase();

export const isPalaceCatalogUrl = (value: string): boolean => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname.endsWith('palace.io')
      || hostname.endsWith('palaceproject.io')
      || hostname.endsWith('thepalaceproject.org')
      || hostname.endsWith('.palace.io')
      || hostname.endsWith('.thepalaceproject.org');
  } catch {
    return false;
  }
};

export const getCommunityCatalogPresets = () => CATALOG_PRESETS.filter((preset) => COMMUNITY_CATALOG_NAMES.has(preset.name));

export const getPalaceRegistryUrl = (): string => (
  REGISTRY_PRESETS.find((registry) => registry.name === 'Palace Libraries')?.url
  || 'https://registry.palaceproject.io/libraries'
);
