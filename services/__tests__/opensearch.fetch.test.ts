import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchOpenSearchDescription } from '../opensearch';
import * as utils from '../utils';

describe('fetchOpenSearchDescription', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and parses an OpenSearch description document', async () => {
    vi.spyOn(utils, 'maybeProxyForCors').mockResolvedValue('https://proxy.example.org/opensearch.xml');
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockResolvedValue(
      new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Catalog Search</ShortName>
  <Url type="application/atom+xml;profile=opds-catalog" template="/search{?searchTerms}" />
</OpenSearchDescription>`,
        {
          status: 200,
          headers: { 'Content-Type': 'application/opensearchdescription+xml' },
        },
      ),
    );

    const result = await fetchOpenSearchDescription('https://catalog.example.org/opensearch.xml');

    expect(utils.maybeProxyForCors).toHaveBeenCalledWith(
      'https://catalog.example.org/opensearch.xml',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.example.org/opensearch.xml',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(result.shortName).toBe('Catalog Search');
    expect(result.activeTemplate?.template).toBe('https://catalog.example.org/search{?searchTerms}');
  });

  it('throws when the description fetch fails', async () => {
    vi.spyOn(utils, 'maybeProxyForCors').mockResolvedValue('https://catalog.example.org/opensearch.xml');
    vi.spyOn(global, 'fetch' as any).mockResolvedValue(
      new Response('not found', { status: 404 }),
    );

    await expect(
      fetchOpenSearchDescription('https://catalog.example.org/opensearch.xml'),
    ).rejects.toThrow('Catalog search is unavailable because the OpenSearch description could not be loaded (404).');
  });

  it('normalizes browser network failures into a stable user-facing error', async () => {
    vi.spyOn(utils, 'maybeProxyForCors').mockResolvedValue('https://catalog.example.org/opensearch.xml');
    vi.spyOn(global, 'fetch' as any).mockRejectedValue(new TypeError('NetworkError when attempting to fetch resource.'));

    await expect(
      fetchOpenSearchDescription('https://catalog.example.org/opensearch.xml'),
    ).rejects.toThrow('Catalog search is unavailable because the OpenSearch description could not be reached.');
  });

  it('uses the proxied URL when CORS probing selects a proxy', async () => {
    vi.spyOn(utils, 'maybeProxyForCors').mockResolvedValue('https://proxy.example.org?url=https%3A%2F%2Fcatalog.example.org%2Fopensearch.xml');
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockResolvedValue(
      new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Catalog Search</ShortName>
  <Url type="application/atom+xml;profile=opds-catalog" template="/search{?searchTerms}" />
</OpenSearchDescription>`,
        {
          status: 200,
          headers: { 'Content-Type': 'application/opensearchdescription+xml' },
        },
      ),
    );

    await fetchOpenSearchDescription('https://catalog.example.org/opensearch.xml');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.example.org?url=https%3A%2F%2Fcatalog.example.org%2Fopensearch.xml',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });
});
