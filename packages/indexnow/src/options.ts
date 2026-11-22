// The plugin's options, checked once in astro.config (so a mistake stops the build) and again
// when the plugin starts. EmDash passes them to the plugin as JSON, so they hold only plain
// values: no functions.

export interface IndexNowCollection {
  /** The address of an entry on the site; `{slug}` is replaced with its slug. */
  path: string;
  /** An entry with this slug is the front page, `/` (for example `home` in `pages`). */
  homeSlug?: string;
  /** Other pages that list these entries and change with them, such as `/blog` or `/`. */
  also?: string[];
  /** A taxonomy whose term pages list the entry, such as `{ taxonomy: 'category', path:
   * '/category/{slug}' }`. */
  terms?: { taxonomy: string; path: string };
}

export interface IndexNowOptions {
  /** The public address of the live site, such as `https://example.org`. Notices are sent only
   * while the site runs at this address. */
  siteUrl: string;
  /** Whether notices are sent at all. Default `false`: set it from the production build's
   * environment, such as `process.env.INDEXNOW === 'on'`. */
  enabled?: boolean;
  /** The IndexNow key: 8 to 128 letters, digits or dashes. Default: from `INDEXNOW_KEY`. */
  key?: string;
  /** The environment variable with the key when `key` isn't given. Default `INDEXNOW_KEY`. */
  keyEnv?: string;
  /** Where the site serves the key file; `{key}` is replaced with the key. Default
   * `/{key}.txt`. It must be at the root, to cover every page. */
  keyLocation?: string;
  /** The collections with public pages. Default `{ posts: { path: '/posts/{slug}' } }`. */
  collections?: Record<string, IndexNowCollection>;
  /** Where notices go. Default `https://api.indexnow.org/indexnow`, which shares them with every
   * search engine that takes IndexNow. */
  endpoint?: string;
}

export interface ResolvedCollection {
  path: string;
  homeSlug: string | null;
  also: string[];
  terms: { taxonomy: string; path: string } | null;
}

export interface ResolvedOptions {
  site: URL;
  enabled: boolean;
  key: string | null;
  keyEnv: string;
  keyLocation: string;
  collections: Record<string, ResolvedCollection>;
  endpoint: URL;
}

const PREFIX = '@borislavhr/emdash-plugin-indexnow:';
const NAME = /^[a-z][a-z0-9_]*$/;
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/;

/** A key as the protocol allows it: 8 to 128 of a-z, A-Z, 0-9 and "-". */
export function isKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{8,128}$/.test(value);
}

function sitePath(value: unknown, what: string, placeholder?: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || /^\/[/\\]/.test(value)) {
    throw new Error(`${PREFIX} ${what} must start with a single "/".`);
  }
  if (placeholder && value.split(placeholder).length !== 2) {
    throw new Error(`${PREFIX} ${what} must contain ${placeholder} once.`);
  }
  if (!placeholder && /[{}?#]/.test(value)) {
    throw new Error(`${PREFIX} ${what} must be a plain path.`);
  }
  return value;
}

function httpsUrl(value: unknown, what: string): URL {
  try {
    const url = new URL(String(value));
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch {
    // reported below
  }
  throw new Error(`${PREFIX} ${what} must be an https address.`);
}

/** Checks the options and fills in the defaults. Throws with a plain message on a mistake. */
export function resolveOptions(options: IndexNowOptions): ResolvedOptions {
  if (!options || typeof options !== 'object') {
    throw new Error(`${PREFIX} options are needed, with at least \`siteUrl\`.`);
  }
  const site = httpsUrl(options.siteUrl, '`siteUrl`');
  if (site.pathname !== '/' || site.search || site.hash) {
    throw new Error(
      `${PREFIX} \`siteUrl\` must be the site's address only, such as https://example.org.`,
    );
  }

  const key = options.key ?? null;
  if (key !== null && !isKey(key)) {
    throw new Error(`${PREFIX} \`key\` must be 8 to 128 letters, digits or dashes.`);
  }
  const keyEnv = options.keyEnv ?? 'INDEXNOW_KEY';
  if (!ENV_NAME.test(keyEnv)) {
    throw new Error(`${PREFIX} \`keyEnv\` must be an environment variable name.`);
  }
  const keyLocation = options.keyLocation ?? '/{key}.txt';
  if (
    typeof keyLocation !== 'string' ||
    !keyLocation.startsWith('/') ||
    keyLocation.startsWith('//')
  ) {
    throw new Error(`${PREFIX} \`keyLocation\` must start with a single "/".`);
  }
  if (keyLocation.lastIndexOf('/') !== 0) {
    throw new Error(
      `${PREFIX} \`keyLocation\` must be at the root (such as /{key}.txt): a key file in a folder only covers that folder's pages.`,
    );
  }

  const given = options.collections ?? { posts: { path: '/posts/{slug}' } };
  if (Object.keys(given).length === 0) {
    throw new Error(`${PREFIX} \`collections\` needs at least one collection.`);
  }
  const collections: Record<string, ResolvedCollection> = {};
  for (const [name, collection] of Object.entries(given)) {
    if (!NAME.test(name)) throw new Error(`${PREFIX} "${name}" is not a collection name.`);
    const terms = collection?.terms;
    if (terms && !NAME.test(terms.taxonomy)) {
      throw new Error(`${PREFIX} the taxonomy for "${name}" must be a taxonomy name.`);
    }
    collections[name] = {
      path: sitePath(collection?.path, `the path for "${name}"`, '{slug}'),
      homeSlug: collection.homeSlug ?? null,
      also: (collection.also ?? []).map((path) => sitePath(path, `a page in "also" for "${name}"`)),
      terms: terms
        ? {
            taxonomy: terms.taxonomy,
            path: sitePath(terms.path, `the term path for "${name}"`, '{slug}'),
          }
        : null,
    };
  }

  return {
    site,
    enabled: options.enabled === true,
    key,
    keyEnv,
    keyLocation,
    collections,
    endpoint: httpsUrl(options.endpoint ?? 'https://api.indexnow.org/indexnow', '`endpoint`'),
  };
}
