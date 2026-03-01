import React, { useState } from 'react';

import { useFocusTrap } from '../hooks';
import { isDebug, maybeProxyForCors, proxiedUrl } from '../services/utils';

const NetworkDebugModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState<string>('');
  const [authHeader, setAuthHeader] = useState<string>('');
  const [includeCreds, setIncludeCreds] = useState<boolean>(true);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen,
    onEscape: onClose,
  });

  if (!isDebug()) return null;

  const runProbe = async (useProxy: boolean = false) => {
    setLoading(true);
    setResult(null);
    try {
      // Build target URL (proxied or direct via maybeProxyForCors)
      let target = url;
      if (useProxy) {
        target = proxiedUrl(url);
      } else {
        // Ask the helper whether proxy would be used for this URL; it may
        // return a proxied URL depending on CORS
        const maybe = await maybeProxyForCors(url);
        target = maybe;
      }

      const headers: Record<string, string> = {};
      if (authHeader) headers['Authorization'] = authHeader;

      // Attempt a HEAD probe first, falling back to GET if server returns 405
      let resp: Response | null = null;
      try {
        resp = await fetch(target, { method: 'HEAD', mode: 'cors', redirect: 'manual', credentials: includeCreds ? 'include' : 'omit', headers });
        if (resp && resp.status === 405) {
          resp = await fetch(target, { method: 'GET', mode: 'cors', redirect: 'manual', credentials: includeCreds ? 'include' : 'omit', headers });
        }
      } catch (e) {
        // network/CORS error
        setResult({ error: String(e), target, requestHeaders: headers, documentCookie: typeof document !== 'undefined' ? document.cookie : '' });
        setLoading(false);
        return;
      }

      // Collect useful response headers we can read from the browser
      const acao = resp.headers.get('access-control-allow-origin');
      const acac = resp.headers.get('access-control-allow-credentials');
      const acah = resp.headers.get('access-control-allow-headers');
      const acem = resp.headers.get('access-control-expose-headers');

      setResult({
        ok: resp.ok,
        status: resp.status,
        statusText: resp.statusText,
        url: resp.url || target,
        accessControlAllowOrigin: acao,
        accessControlAllowCredentials: acac,
        accessControlAllowHeaders: acah,
        accessControlExposeHeaders: acem,
        requestHeaders: headers,
        proxied: target !== url,
        proxiedUrl: target !== url ? target : null,
        documentCookie: typeof document !== 'undefined' ? document.cookie : '',
      });
    } catch (e) {
      setResult({ error: String(e) });
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div
        ref={modalRef}
        className="theme-surface-elevated theme-border theme-text-primary w-full max-w-2xl overflow-auto rounded border shadow-lg"
        style={{ maxHeight: '80vh' }}
      >
        <div className="theme-divider flex items-center justify-between border-b p-4">
          <strong>Network Debug</strong>
          <div>
            <button className="theme-button-neutral theme-hover-surface mr-2 rounded px-3 py-1" onClick={() => { setUrl(''); setResult(null); }}>Clear</button>
            <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="p-4">
          <div className="mb-2">
            <label className="block text-sm font-medium">Target URL</label>
            <input className="theme-input w-full rounded border p-2" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.org/opds/borrow/123" />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Authorization header (optional)</label>
            <input className="theme-input w-full rounded border p-2" value={authHeader} onChange={e => setAuthHeader(e.target.value)} placeholder="Basic base64(...)" />
            <div className="theme-text-secondary text-xs">You can paste an Authorization header value to simulate client-sent auth. Note: browsers may preflight requests when custom headers are present.</div>
          </div>
          <div className="mb-4 flex items-center gap-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={includeCreds} onChange={e => setIncludeCreds(e.target.checked)} /> Include credentials (cookies)</label>
          </div>

          <div className="mb-4 flex gap-2">
            <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => runProbe(false)} disabled={loading || !url}>Probe (auto)</button>
            <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={() => runProbe(true)} disabled={loading || !url}>Force Proxy</button>
          </div>

          <div className="text-sm">
            {loading && <div>Running probe...</div>}
            {result && (
              <div className="mt-3">
                <div><strong>Target used:</strong> {result.url || result.target}</div>
                <div><strong>Proxied:</strong> {String(result.proxied)}</div>
                {result.proxiedUrl && <div><strong>Proxied URL:</strong> {result.proxiedUrl}</div>}
                <div><strong>Response:</strong> {result.status} {result.statusText}</div>
                <div><strong>Access-Control-Allow-Origin:</strong> {String(result.accessControlAllowOrigin)}</div>
                <div><strong>Access-Control-Allow-Credentials:</strong> {String(result.accessControlAllowCredentials)}</div>
                <div><strong>Access-Control-Allow-Headers:</strong> {String(result.accessControlAllowHeaders)}</div>
                <div><strong>Access-Control-Expose-Headers:</strong> {String(result.accessControlExposeHeaders)}</div>
                <div className="mt-2"><strong>Request headers sent (client-side):</strong>
                  <pre className="theme-surface rounded p-2 text-xs overflow-auto">{JSON.stringify(result.requestHeaders, null, 2)}</pre>
                </div>
                <div className="mt-2"><strong>document.cookie (current origin):</strong>
                  <pre className="theme-surface rounded p-2 text-xs overflow-auto">{result.documentCookie || '<none>'}</pre>
                </div>
                <div className="theme-text-secondary mt-2 text-xs">Limitations: The browser will not expose cross-origin cookies or Set-Cookie headers to JavaScript. A missing Access-Control-Allow-Origin or Access-Control-Allow-Credentials header will still prevent the browser from exposing the response body to the app.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkDebugModal;
