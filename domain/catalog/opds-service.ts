/**
 * OPDS Parser Service
 *
 * Service layer for parsing OPDS feeds (both OPDS 1 and OPDS 2).
 * This provides a clean interface over the existing parsing functions
 * and adds proper error handling.
 */

import { logger } from '../../services/logger';
import { fetchCatalogContent, parseOpds1Xml, resolveAcquisitionChainOpds1 } from '../../services/opds';
import { parseOpds2Json, resolveAcquisitionChain as resolveOpds2 } from '../../services/opds2';

import type {
  CatalogBook,
  CatalogNavigationLink,
  CatalogPagination,
} from './types';

/**
 * Result type for parser operations
 */
export type ParserResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number; proxyUsed?: boolean };

/**
 * Parsed catalog data
 */
export interface ParsedCatalog {
  books: CatalogBook[];
  navLinks: CatalogNavigationLink[];
  pagination: CatalogPagination;
}

/**
 * OPDS version enumeration
 */
export type OPDSVersion = '1' | '2' | 'auto';

/**
 * OPDS Parser Service
 *
 * Handles parsing of OPDS 1 (Atom/XML) and OPDS 2 (JSON) feeds.
 */
export class OPDSParserService {
  async fetchCatalog(
    url: string,
    baseUrl: string,
    opdsVersion: OPDSVersion = 'auto',
  ): Promise<ParserResult<ParsedCatalog>> {
    try {
      const hostname = (() => {
        try {
          return new URL(url).hostname.toLowerCase();
        } catch {
          return '';
        }
      })();

      const isPalaceHost =
        hostname.endsWith('palace.io') ||
        hostname.endsWith('palaceproject.io') ||
        hostname.endsWith('thepalaceproject.org') ||
        hostname === 'palace.io' ||
        hostname.endsWith('.palace.io') ||
        hostname.endsWith('.thepalaceproject.org');

      const forcedVersion: OPDSVersion = isPalaceHost ? '1' : opdsVersion;
      const result = await fetchCatalogContent(url, baseUrl, forcedVersion);

      if (result.error) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          books: result.books,
          navLinks: result.navLinks,
          pagination: result.pagination,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching OPDS catalog';
      logger.error('OPDS fetch error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Parse an OPDS 1 feed (Atom/XML)
   *
   * @param xmlText - The XML content to parse
   * @param baseUrl - Base URL for resolving relative links
   * @returns Parsed catalog data or error
   */
  async parseOPDS1(xmlText: string, baseUrl: string): Promise<ParserResult<ParsedCatalog>> {
    try {
      logger.info('Parsing OPDS 1 feed', { baseUrl });

      const result = parseOpds1Xml(xmlText, baseUrl);

      logger.info('OPDS 1 parse successful', {
        bookCount: result.books.length,
        navLinkCount: result.navLinks.length,
      });

      return {
        success: true,
        data: {
          books: result.books,
          navLinks: result.navLinks,
          pagination: result.pagination,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error parsing OPDS 1';
      logger.error('OPDS 1 parse error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Parse an OPDS 2 feed (JSON)
   *
   * @param jsonData - The JSON data to parse (already parsed from string)
   * @param baseUrl - Base URL for resolving relative links
   * @returns Parsed catalog data or error
   */
  async parseOPDS2(jsonData: any, baseUrl: string): Promise<ParserResult<ParsedCatalog>> {
    try {
      logger.info('Parsing OPDS 2 feed', { baseUrl });

      const result = parseOpds2Json(jsonData, baseUrl);
      if ((result as any).error) {
        const errorMessage = (result as any).error as string;
        logger.error('OPDS 2 parse reported error', { baseUrl, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      logger.info('OPDS 2 parse successful', {
        bookCount: result.books.length,
        navLinkCount: result.navLinks.length,
      });

      return {
        success: true,
        data: {
          books: result.books,
          navLinks: result.navLinks,
          pagination: result.pagination,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error parsing OPDS 2';
      logger.error('OPDS 2 parse error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Auto-detect OPDS version and parse accordingly
   *
   * @param content - The content to parse (string for XML, object for JSON)
   * @param baseUrl - Base URL for resolving relative links
   * @returns Parsed catalog data or error
   */
  async parseOPDS(content: string | any, baseUrl: string): Promise<ParserResult<ParsedCatalog>> {
    try {
      // If content is already an object, it's OPDS 2 JSON
      if (typeof content === 'object' && content !== null) {
        return this.parseOPDS2(content, baseUrl);
      }

      // If content is a string, check if it's XML or JSON
      const trimmedContent = content.trim();

      if (trimmedContent.startsWith('<')) {
        // It's XML - OPDS 1
        return this.parseOPDS1(trimmedContent, baseUrl);
      } else if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
        // It's JSON - OPDS 2
        try {
          const jsonData = JSON.parse(trimmedContent);
          return this.parseOPDS2(jsonData, baseUrl);
        } catch (parseError) {
          return { success: false, error: 'Invalid JSON content' };
        }
      }

      return { success: false, error: 'Unable to detect OPDS version' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error parsing OPDS';
      logger.error('OPDS auto-parse error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Detect OPDS version from content
   *
   * @param content - The content to analyze
   * @returns OPDS version or null if unable to detect
   */
  detectVersion(content: string | any): OPDSVersion | null {
    if (typeof content === 'object' && content !== null) {
      return '2';
    }

    if (typeof content === 'string') {
      const trimmed = content.trim();
      if (trimmed.startsWith('<')) {
        return '1';
      } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return '2';
      }
    }

    return null;
  }
}

/**
 * OPDS Acquisition Service
 *
 * Handles resolving acquisition links to downloadable URLs.
 * OPDS feeds often use indirect acquisition links that need to be resolved.
 */
export class OPDSAcquisitionService {
  /**
   * Resolve an OPDS 2 acquisition chain
   *
   * @param href - The acquisition link to resolve
   * @param credentials - Optional credentials for authentication
   * @param maxRedirects - Maximum number of redirects to follow (default: 5)
   * @returns Final download URL or error
   */
  async resolveOPDS2(
    href: string,
    credentials?: { username: string; password: string } | null,
    maxRedirects = 5,
  ): Promise<ParserResult<string>> {
    try {
      logger.info('Resolving OPDS 2 acquisition chain', { href });

      const url = await resolveOpds2(href, credentials, maxRedirects);

      if (!url) {
        return { success: false, error: 'Failed to resolve acquisition chain' };
      }

      logger.info('OPDS 2 acquisition resolved', { finalUrl: url });
      return { success: true, data: url };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error resolving acquisition';
      logger.error('OPDS 2 acquisition error:', errorMessage);

      // Preserve error metadata for authentication and proxy detection
      return {
        success: false,
        error: errorMessage,
        status: error?.status,
        proxyUsed: error?.proxyUsed,
      };
    }
  }

  /**
   * Resolve an OPDS 1 acquisition chain
   *
   * @param href - The acquisition link to resolve
   * @param credentials - Optional credentials for authentication
   * @param maxRedirects - Maximum number of redirects to follow (default: 5)
   * @returns Final download URL or error
   */
  async resolveOPDS1(
    href: string,
    credentials?: { username: string; password: string } | null,
    maxRedirects = 5,
  ): Promise<ParserResult<string>> {
    try {
      logger.info('Resolving OPDS 1 acquisition chain', { href });

      const url = await resolveAcquisitionChainOpds1(href, credentials, maxRedirects);

      if (!url) {
        return { success: false, error: 'Failed to resolve acquisition chain' };
      }

      logger.info('OPDS 1 acquisition resolved', { finalUrl: url });
      return { success: true, data: url };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error resolving acquisition';
      logger.error('OPDS 1 acquisition error:', errorMessage);

      // Preserve error metadata for authentication and proxy detection
      return {
        success: false,
        error: errorMessage,
        status: error?.status,
        proxyUsed: error?.proxyUsed,
      };
    }
  }

  /**
   * Resolve an acquisition chain (auto-detect version)
   *
   * @param href - The acquisition link to resolve
   * @param version - OPDS version ('1', '2', or 'auto' to try both)
   * @param credentials - Optional credentials for authentication
   * @param maxRedirects - Maximum number of redirects to follow
   * @returns Final download URL or error
   */
  async resolve(
    href: string,
    version: OPDSVersion = 'auto',
    credentials?: { username: string; password: string } | null,
    maxRedirects = 5,
  ): Promise<ParserResult<string>> {
    if (version === '2') {
      return this.resolveOPDS2(href, credentials, maxRedirects);
    } else if (version === '1') {
      return this.resolveOPDS1(href, credentials, maxRedirects);
    }

    // Auto-detect: Try OPDS 2 first (more common), then fall back to OPDS 1
    logger.info('Auto-detecting OPDS version for acquisition', { href });

    const opds2Result = await this.resolveOPDS2(href, credentials, maxRedirects);
    if (opds2Result.success) {
      return opds2Result;
    }

    logger.info('OPDS 2 resolution failed, trying OPDS 1', { href });
    return this.resolveOPDS1(href, credentials, maxRedirects);
  }
}

// Singleton instances for convenience
export const opdsParserService = new OPDSParserService();
export const opdsAcquisitionService = new OPDSAcquisitionService();
