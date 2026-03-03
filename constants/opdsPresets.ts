export interface CatalogPreset {
  name: string;
  url: string;
  opdsVersion: 'auto' | '1' | '2';
  description: string;
}

export interface RegistryPreset {
  name: string;
  url: string;
  description: string;
}

export const CATALOG_PRESETS: CatalogPreset[] = [
  {
    name: 'Project Gutenberg',
    url: 'http://165.227.102.164:8080/opds/',
    opdsVersion: '1',
    description: 'Public domain classics and reference works.',
  },
  {
    name: 'Standard Ebooks',
    url: 'https://standardebooks.org/opds/all',
    opdsVersion: 'auto',
    description: 'Carefully produced public domain editions.',
  },
  {
    name: 'Feedbooks Public Domain',
    url: 'https://www.feedbooks.com/publicdomain/catalog.atom',
    opdsVersion: '1',
    description: 'Public domain books in a classic OPDS catalog.',
  },
  {
    name: 'Internet Archive',
    url: 'https://bookserver.archive.org/catalog/',
    opdsVersion: '1',
    description: 'Archive.org OPDS catalog for open books.',
  },
  {
    name: 'Open Library',
    url: 'https://openlibrary.org/api/volumes/brief/json/opds',
    opdsVersion: 'auto',
    description: 'Open Library OPDS feed for browsable book data.',
  },
  {
    name: 'BiblioBoard',
    url: 'https://catalog.biblioboard.com/',
    opdsVersion: 'auto',
    description: 'Community and library-hosted digital collections.',
  },
  {
    name: 'Open Research Library',
    url: 'https://catalog.openresearchlibrary.org/opds/v2/',
    opdsVersion: '2',
    description: 'Open-access academic and scholarly publishing.',
  },
  {
    name: 'PressBooks',
    url: 'https://pressbooks.directory/opds',
    opdsVersion: 'auto',
    description: 'Open educational books and publishing projects.',
  },
  {
    name: 'UPLOpen',
    url: 'https://uplo.rua.re/api/opds/v2/books/',
    opdsVersion: '2',
    description: 'Open-access publishing from the University Press Library Open initiative.',
  },
  {
    name: 'Fulcrum',
    url: 'https://www.fulcrum.org/api/opds',
    opdsVersion: '2',
    description: 'Scholarly publishing and digital collections from Fulcrum.',
  },
];

export const REGISTRY_PRESETS: RegistryPreset[] = [
  {
    name: 'Palace Libraries',
    url: 'https://registry.palaceproject.io/libraries',
    description: 'Palace library registry for discovering member library catalogs.',
  },
  {
    name: 'OPDS Home',
    url: 'https://opdshome.uo1.net/',
    description: 'A public OPDS start page and registry-style directory.',
  },
];
