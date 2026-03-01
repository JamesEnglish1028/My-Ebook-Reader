// OPDS2 Publication interface
export interface Opds2Publication {
  metadata?: {
    title?: string;
  author?: string | { name?: string } | (string | { name?: string })[];
    description?: string;
    subtitle?: string;
    publisher?: string | { name?: string };
    published?: string;
    issued?: string;
    identifier?: string | string[];
  subject?: string[] | (string | { name?: string })[];
  image?: { href?: string; url?: string }[];
    '@type'?: string;
    type?: string;
  };
  images?: { href?: string; url?: string }[];
  links?: Opds2Link[] | string;
  properties?: {
    links?: Opds2Link[] | string;
    link?: Opds2Link[] | string;
    acquisitions?: Opds2Link[] | string;
  };
  content?: { href?: string; type?: string }[];
}

// OPDS2 Link interface
export interface Opds2Link {
  href?: string;
  rel?: string | string[];
  title?: string;
  type?: string;
  templated?: boolean;
  isCatalog?: boolean;
  indirectAcquisition?: unknown;
  properties?: {
    indirectAcquisition?: unknown;
  };
}

// OPDS2 Navigation Group interface
export interface Opds2NavigationGroup {
  metadata?: { title?: string };
  navigation?: Opds2Link[];
}
