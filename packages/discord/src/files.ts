// The address of an entry's picture, from the value EmDash stores in an image field.

const ALLOWED_SCHEMES = ['https:', 'http:'];

/**
 * A link that is safe to send: a site path ("/…") or an http(s) address. Anything that could
 * leave the site unexpectedly ("//host", "/\host", "javascript:") gives undefined.
 */
export function safeHref(value: string | null | undefined): string | undefined {
  // Browsers ignore tabs and line breaks inside URLs, so "/\t/evil" would become "//evil".
  const href = value?.replace(/[\t\n\r]/g, '').trim();
  if (!href) return undefined;
  if (href.startsWith('/')) return /^\/[/\\]/.test(href) ? undefined : href;
  try {
    const { protocol } = new URL(href);
    if (!ALLOWED_SCHEMES.includes(protocol)) return undefined;
    return `${protocol}${href.slice(protocol.length)}`;
  } catch {
    return undefined;
  }
}

interface StoredFile {
  url?: unknown;
  src?: unknown;
  provider?: unknown;
  meta?: { storageKey?: unknown } | null;
}

/**
 * The picture's address: the value's own `url` or `src`, or, for a file in EmDash's own media
 * library, EmDash's media address for its storage key.
 */
export function fileHref(file: unknown): string | undefined {
  if (!file || typeof file !== 'object') return undefined;
  const { url, src, provider, meta } = file as StoredFile;
  const ready = [url, src].find((value): value is string => typeof value === 'string');
  const direct = safeHref(ready);
  if (direct) return direct;
  const key = meta?.storageKey;
  if (provider !== 'local' || typeof key !== 'string' || !key) return undefined;
  return `/_emdash/api/media/file/${encodeURIComponent(key)}`;
}
