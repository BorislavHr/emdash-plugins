// The plugin's options, checked once in astro.config (so a mistake stops the build) and again
// when the plugin starts. EmDash passes them to the plugin as JSON, so they hold only plain
// values: no functions.
import { DEFAULT_TEXT, type ReviewLinkText } from './text.ts';

export interface ReviewLinkOptions {
  /**
   * The collections that get the panel, each with the address of its entries on the site.
   * `{slug}` is replaced with the entry's slug. Default: `{ posts: '/posts/{slug}' }`.
   */
  collections?: Record<string, string>;
  /** How long a link works, in days: 1 to 30. Default 7. */
  days?: number;
  /** The language the end date is written in (a BCP 47 tag). Default `en-GB`. */
  dateLocale?: string;
  /** The time zone the end date is written in. Default `UTC`. */
  timeZone?: string;
  /** Replaces any of the panel's words. */
  text?: Partial<ReviewLinkText>;
  /** Where the panel sits among the editor's panels; lower comes first. Default 4. */
  order?: number;
}

export interface ResolvedOptions {
  collections: Record<string, string>;
  days: number;
  dateLocale: string;
  timeZone: string;
  text: ReviewLinkText;
  order: number;
}

export const MAX_DAYS = 30;

const COLLECTION_NAME = /^[a-z][a-z0-9_]*$/;
const PREFIX = '@borislavhr/emdash-plugin-review-link:';

/** Checks the options and fills in the defaults. Throws with a plain message on a mistake. */
export function resolveOptions(options: ReviewLinkOptions = {}): ResolvedOptions {
  const collections = options.collections ?? { posts: '/posts/{slug}' };
  if (Object.keys(collections).length === 0) {
    throw new Error(`${PREFIX} \`collections\` needs at least one collection.`);
  }
  for (const [name, pattern] of Object.entries(collections)) {
    if (!COLLECTION_NAME.test(name)) {
      throw new Error(`${PREFIX} "${name}" is not a collection name.`);
    }
    if (typeof pattern !== 'string' || !pattern.startsWith('/') || /^\/[/\\]/.test(pattern)) {
      throw new Error(`${PREFIX} the address for "${name}" must start with a single "/".`);
    }
    if (pattern.split('{slug}').length !== 2) {
      throw new Error(`${PREFIX} the address for "${name}" must contain {slug} once.`);
    }
  }

  const days = options.days ?? 7;
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    throw new Error(`${PREFIX} \`days\` must be a whole number from 1 to ${MAX_DAYS}.`);
  }

  const dateLocale = options.dateLocale ?? 'en-GB';
  const timeZone = options.timeZone ?? 'UTC';
  // Both are checked by writing a date with them: a wrong one throws a RangeError here.
  new Date(0).toLocaleString(dateLocale, { timeZone });

  return {
    collections: { ...collections },
    days,
    dateLocale,
    timeZone,
    text: { ...DEFAULT_TEXT, ...options.text },
    order: options.order ?? 4,
  };
}
