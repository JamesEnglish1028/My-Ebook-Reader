import type {
  OpenSearchDescriptionDocument,
  OpenSearchTemplateParameter,
  OpenSearchUrlTemplate,
} from '../types';
import { maybeProxyForCors } from './utils';

const OPDS_ATOM_TYPE = 'application/atom+xml;profile=opds-catalog';
const OPDS_JSON_TYPE = 'application/opds+json';
const TEMPLATE_OPEN = '__OPENSEARCH_OPEN__';
const TEMPLATE_CLOSE = '__OPENSEARCH_CLOSE__';

function getDirectChildText(parent: Element, localName: string): string | undefined {
  const child = Array.from(parent.children).find((node) => {
    const name = (node.localName || node.nodeName || '').toLowerCase();
    return name === localName.toLowerCase();
  });
  const text = child?.textContent?.trim();
  return text || undefined;
}

function parseTemplateParameters(template: string): OpenSearchTemplateParameter[] {
  const matches = template.matchAll(/\{([^}]+)\}/g);
  const params: OpenSearchTemplateParameter[] = [];

  for (const match of matches) {
    const rawValue = String(match[1] || '').trim();
    if (!rawValue) continue;
    const operator = '?&/#.;+'.includes(rawValue[0] || '') ? rawValue[0] : '';
    const expression = operator ? rawValue.slice(1) : rawValue;
    const variables = expression.split(',').map((part) => part.trim()).filter(Boolean);

    variables.forEach((variable) => {
      const required = !variable.endsWith('?');
      const normalized = required ? variable : variable.slice(0, -1);
      const [namespace, localName] = normalized.includes(':')
        ? normalized.split(/:(.+)/, 2)
        : [undefined, normalized];

      const name = (localName || normalized).trim();
      if (!name) return;

      params.push({
        name,
        required,
        namespace: namespace?.trim() || undefined,
      });
    });
  }

  return params;
}

function resolveTemplateUrl(template: string, baseUrl: string): string {
  const masked = template
    .replaceAll('{', TEMPLATE_OPEN)
    .replaceAll('}', TEMPLATE_CLOSE);
  const resolved = new URL(masked, baseUrl).href;
  return resolved
    .replaceAll(TEMPLATE_OPEN, '{')
    .replaceAll(TEMPLATE_CLOSE, '}');
}

function scoreUrlTemplate(template: OpenSearchUrlTemplate): number {
  const type = String(template.type || '').toLowerCase();
  if (type.includes(OPDS_ATOM_TYPE)) return 300;
  if (type.includes(OPDS_JSON_TYPE)) return 200;
  if (type.includes('application/atom+xml')) return 150;
  if (type.includes('application/json')) return 100;
  return 0;
}

function selectPreferredUrlTemplate(urls: OpenSearchUrlTemplate[]): OpenSearchUrlTemplate | undefined {
  if (urls.length === 0) return undefined;

  return [...urls].sort((left, right) => {
    const scoreDelta = scoreUrlTemplate(right) - scoreUrlTemplate(left);
    if (scoreDelta !== 0) return scoreDelta;
    return left.method.localeCompare(right.method);
  })[0];
}

function cleanUrlArtifacts(url: string): string {
  return url
    .replace(/([?&])[^=&?#]+=(?=&|$)/g, '$1')
    .replace(/[?&]{2,}/g, '?')
    .replace(/\?&/g, '?')
    .replace(/[?&]+$/g, '');
}

function getTemplateLookupKeys(
  normalizedToken: string,
): { lookupKey: string; queryKey: string } {
  if (normalizedToken.includes(':')) {
    const [namespace, localName] = normalizedToken.split(/:(.+)/, 2);
    return {
      lookupKey: localName,
      queryKey: `${namespace}:${localName}`,
    };
  }

  return {
    lookupKey: normalizedToken,
    queryKey: normalizedToken,
  };
}

function resolveTemplateValue(
  rawToken: string,
  values: Record<string, string | number | undefined>,
): string {
  const required = !rawToken.endsWith('?');
  const normalized = required ? rawToken : rawToken.slice(0, -1);
  const { lookupKey } = getTemplateLookupKeys(normalized);
  const resolved = values[lookupKey] ?? values[normalized];

  if (resolved === undefined || resolved === null || String(resolved).length === 0) {
    if (required) {
      throw new Error(`Missing required OpenSearch parameter: ${lookupKey}`);
    }
    return '';
  }

  return encodeURIComponent(String(resolved));
}

function expandTemplateExpression(
  rawExpression: string,
  values: Record<string, string | number | undefined>,
): string {
  const operator = '?&'.includes(rawExpression[0] || '') ? rawExpression[0] : '';
  const expression = operator ? rawExpression.slice(1) : rawExpression;
  const variables = expression.split(',').map((part) => part.trim()).filter(Boolean);

  if (!operator) {
    return variables
      .map((variable) => resolveTemplateValue(variable, values))
      .join(',');
  }

  const pairs = variables
    .map((variable) => {
      const required = !variable.endsWith('?');
      const normalized = required ? variable : variable.slice(0, -1);
      const { lookupKey, queryKey } = getTemplateLookupKeys(normalized);
      const resolved = values[lookupKey] ?? values[normalized];

      if (resolved === undefined || resolved === null || String(resolved).length === 0) {
        if (required) {
          throw new Error(`Missing required OpenSearch parameter: ${lookupKey}`);
        }
        return null;
      }

      return `${queryKey}=${encodeURIComponent(String(resolved))}`;
    })
    .filter((value): value is string => value !== null);

  if (pairs.length === 0) return '';
  return `${operator}${pairs.join('&')}`;
}

export function parseOpenSearchDescription(
  xmlText: string,
  baseUrl: string,
): OpenSearchDescriptionDocument {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  const errorNode = xmlDoc.querySelector('parsererror');
  if (errorNode) {
    throw new Error('Failed to parse OpenSearch description document.');
  }

  const rootNodeName = xmlDoc.documentElement?.nodeName?.toLowerCase() || '';
  if (!rootNodeName.includes('opensearchdescription')) {
    throw new Error('Invalid OpenSearch description document.');
  }

  const root = xmlDoc.documentElement;
  const urlNodes = Array.from(root.children).filter((node) => {
    const name = (node.localName || node.nodeName || '').toLowerCase();
    return name === 'url';
  });

  const urls: OpenSearchUrlTemplate[] = urlNodes
    .map((node) => {
      const template = node.getAttribute('template')?.trim();
      if (!template) return null;

      const resolvedTemplate = resolveTemplateUrl(template, baseUrl);
      const method = node.getAttribute('method')?.trim() || 'GET';
      const rel = node.getAttribute('rel')?.trim() || undefined;
      const indexOffset = Number(node.getAttribute('indexOffset'));
      const pageOffset = Number(node.getAttribute('pageOffset'));

      return {
        template: resolvedTemplate,
        type: node.getAttribute('type')?.trim() || undefined,
        method,
        rel,
        indexOffset: Number.isFinite(indexOffset) ? indexOffset : undefined,
        pageOffset: Number.isFinite(pageOffset) ? pageOffset : undefined,
        params: parseTemplateParameters(resolvedTemplate),
      } satisfies OpenSearchUrlTemplate;
    })
    .filter((value): value is OpenSearchUrlTemplate => value !== null);

  return {
    shortName: getDirectChildText(root, 'ShortName'),
    description: getDirectChildText(root, 'Description'),
    tags: getDirectChildText(root, 'Tags')?.split(/\s+/).filter(Boolean),
    urls,
    activeTemplate: selectPreferredUrlTemplate(urls),
  };
}

export function buildOpenSearchUrl(
  template: string | OpenSearchUrlTemplate,
  values: Record<string, string | number | undefined>,
): string {
  const rawTemplate = typeof template === 'string' ? template : template.template;
  const resolved = rawTemplate.replace(/\{([^}]+)\}/g, (_match, rawToken) =>
    expandTemplateExpression(String(rawToken || '').trim(), values),
  );

  return cleanUrlArtifacts(resolved);
}

export async function fetchOpenSearchDescription(
  descriptionUrl: string,
): Promise<OpenSearchDescriptionDocument> {
  try {
    const fetchUrl = await maybeProxyForCors(descriptionUrl);
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/opensearchdescription+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`Catalog search is unavailable because the OpenSearch description could not be loaded (${response.status}).`);
    }

    const xmlText = await response.text();
    return parseOpenSearchDescription(xmlText, descriptionUrl);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('Catalog search is unavailable')
        || error.message.includes('Invalid OpenSearch description document.')
        || error.message.includes('Failed to parse OpenSearch description document.')
      ) {
        throw error;
      }
    }

    throw new Error('Catalog search is unavailable because the OpenSearch description could not be reached.');
  }
}
