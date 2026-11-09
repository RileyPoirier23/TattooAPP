// Short-lived caches for public, user-independent responses. Under a traffic spike most requests are the
// same few reads (the home page, the pros list, the site config), so each is built and compressed once
// every few seconds instead of once per request. Nothing here is served to a logged-in user as their own
// data: callers only cache responses that look the same for everyone.
import zlib from 'node:zlib';
import type { Request, Response } from 'express';

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 2000;

/** Returns the cached value for `key`, or builds it with `produce` and keeps it for `ttlMs`. */
export function memo<T>(key: string, ttlMs: number, produce: () => T): T {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = produce();
  store.set(key, { value, expires: Date.now() + ttlMs });
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value!);
  return value;
}

/** Forgets every entry whose key starts with `prefix` (or everything when no prefix is given). */
export function invalidate(prefix = ''): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

interface Rendered {
  json: Buffer;
  gzip: Buffer;
  etag: string;
}

/**
 * Sends a JSON response that is identical for every visitor, from a cache of the serialized and
 * gzipped body. Keeps the API's `Cache-Control: no-store` (browsers never keep it) while the server
 * only does the work once per `ttlMs`.
 */
export function sendCachedJson(req: Request, res: Response, key: string, ttlMs: number, produce: () => unknown): void {
  const entry = memo<Rendered>(`json:${key}`, ttlMs, () => {
    const json = Buffer.from(JSON.stringify(produce()));
    return { json, gzip: zlib.gzipSync(json, { level: 6 }), etag: `W/"${json.length}-${hash(json)}"` };
  });
  res.set('Vary', 'Accept-Encoding');
  res.set('ETag', entry.etag);
  if (req.headers['if-none-match'] === entry.etag) {
    res.status(304).end();
    return;
  }
  res.type('application/json');
  const accepts = String(req.headers['accept-encoding'] || '');
  if (/\bgzip\b/.test(accepts) && entry.gzip.length < entry.json.length) {
    res.set('Content-Encoding', 'gzip');
    res.send(entry.gzip);
  } else {
    res.send(entry.json);
  }
}

function hash(buf: Buffer): string {
  // FNV-1a: cheap and good enough to tell versions of one response apart.
  let h = 0x811c9dc5;
  for (let i = 0; i < buf.length; i++) {
    h ^= buf[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}
