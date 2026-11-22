// What an IndexNow notice says, kept apart from EmDash so it can be tested: which public
// addresses a change touches, and the request that tells search engines about them.
import { isKey, type ResolvedCollection } from './options.ts';

/** A slug put into a path, or undefined when it could leave its path ("..", "/", "?", "#"). */
export function fill(pattern: string, slug: unknown): string | undefined {
  if (typeof slug !== 'string') return undefined;
  if (slug.length === 0 || slug.length > 200 || slug === '.' || slug === '..') return undefined;
  if (/[\s/\\?#%]/.test(slug)) return undefined;
  return pattern.replace('{slug}', encodeURIComponent(slug));
}

export interface Change {
  collection: ResolvedCollection | undefined;
  slug: unknown;
  /** The entry's terms in the collection's taxonomy, by slug: their pages list it too. */
  terms?: readonly string[];
}

/** The site paths a change touches: the entry's own page and the pages that list it. */
export function pathsFor({ collection, slug, terms = [] }: Change): string[] {
  if (!collection) return [];
  const own =
    collection.homeSlug !== null && slug === collection.homeSlug
      ? '/'
      : fill(collection.path, slug);
  if (!own) return [];
  const listed = collection.terms
    ? terms.map((term) => fill(collection.terms!.path, term)).filter((path) => path !== undefined)
    : [];
  return [...new Set([own, ...collection.also, ...listed])];
}

/** The key from the options, or else from the environment; undefined when neither is usable. */
export function keyFrom(
  key: string | null,
  name: string,
  env: Record<string, string | undefined> | undefined = globalThis.process?.env,
): string | undefined {
  const value = key ?? env?.[name]?.trim();
  return isKey(value) ? value : undefined;
}

/** Whether the site is running at its public address: notices are sent only from there. */
export function isLiveSite(current: string, site: URL): boolean {
  try {
    return new URL(current).origin === site.origin;
  } catch {
    return false;
  }
}

/** The body of an IndexNow notice, as the protocol wants it (https://www.indexnow.org). */
export function noticeBody(site: URL, key: string, keyLocation: string, paths: readonly string[]) {
  return {
    host: site.host,
    key,
    keyLocation: new URL(keyLocation.replace('{key}', key), site).href,
    urlList: [...new Set(paths)].map((path) => new URL(path, site).href),
  };
}
