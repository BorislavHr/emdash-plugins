// The review link itself: EmDash's own signed preview link, made to last days instead of the
// admin's one hour. Kept apart from plugin.ts so it can be tested without a running site.
import { buildPreviewUrl, generatePreviewToken } from 'emdash';

type Env = Record<string, string | undefined>;

/**
 * EmDash signs and checks preview links with EMDASH_PREVIEW_SECRET (or else PREVIEW_SECRET) when
 * one is set, read from the environment as here. Without either, EmDash keeps a secret of its own
 * in the database, which a plugin can't read, so the plugin needs the setting.
 */
export function previewSecret(env: Env | undefined = globalThis.process?.env): string | undefined {
  for (const name of ['EMDASH_PREVIEW_SECRET', 'PREVIEW_SECRET']) {
    const value = env?.[name]?.trim();
    // The first one that is set is the one EmDash uses, so it decides, even when it is too short.
    if (value) return isSecret(value) ? value : undefined;
  }
  return undefined;
}

/**
 * A secret long enough to sign with: at least 32 characters (`openssl rand -hex 32` gives 64).
 * Anything shorter counts as not set up, so a placeholder value can't sign real links.
 */
export function isSecret(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 32;
}

/**
 * The entry's address on the site from the collection's pattern, or undefined when the entry has
 * no usable slug yet. A slug that could leave its path ("..", a slash, "?", "#", "%") gets none.
 */
export function reviewPath(pattern: string | undefined, slug: unknown): string | undefined {
  if (!pattern || typeof slug !== 'string') return undefined;
  if (slug.length === 0 || slug.length > 200 || slug === '.' || slug === '..') return undefined;
  if (/[\s/\\?#%]/.test(slug)) return undefined;
  return pattern.replace('{slug}', encodeURIComponent(slug));
}

/**
 * A link that shows the entry's current draft to anyone who has it, until it expires. The token
 * names the entry by collection and ID, as EmDash's own preview links do, so EmDash checks it
 * with the same secret.
 */
export async function makeReviewLink(options: {
  collection: string;
  id: string;
  path: string;
  secret: string;
  base: string;
  days: number;
}): Promise<{ url: string; expires: Date }> {
  const seconds = options.days * 24 * 60 * 60;
  const token = await generatePreviewToken({
    contentId: `${options.collection}:${options.id}`,
    expiresIn: seconds,
    secret: options.secret,
  });
  return {
    url: buildPreviewUrl({ path: options.path, token, baseUrl: options.base }),
    expires: new Date(Date.now() + seconds * 1000),
  };
}
