// The plugin's options, checked once in astro.config (so a mistake stops the build) and again
// when the plugin starts. EmDash passes them to the plugin as JSON, so they hold only plain
// values: no functions.
import { DEFAULT_TEXT, type DiscordText } from './text.ts';

export interface DiscordCollection {
  /** The address of an entry on the site; `{slug}` is replaced with its slug. */
  path: string;
  /** What one entry is called in the panel and the post ("post", "guide"). Default: the
   * collection's name. */
  name?: string;
}

export interface DiscordOptions {
  /**
   * The collections that are announced. Default: `{ posts: { path: '/posts/{slug}', name:
   * 'post' } }`. Announce only pages people read, never anything visitors send in.
   */
  collections?: Record<string, DiscordCollection>;
  /** The field with the entry's title. Default `title`. */
  titleField?: string;
  /** The field with a short summary, cut to 300 characters. Default `excerpt`; `null`: none. */
  summaryField?: string | null;
  /** The image field whose picture is shown. Default `featured_image`; `null`: none. */
  imageField?: string | null;
  /** A taxonomy whose first term is shown under the post (for example `category`). */
  taxonomy?: string;
  /** A picture for an entry without one, by that taxonomy's term slug: a site path or https. */
  termImages?: Record<string, string>;
  /** A picture for an entry with none of its own and no term picture: a site path or https. */
  defaultImage?: string;
  /** The colour of the line down the side of the post, as `#rrggbb`. Default: Discord's. */
  colour?: string;
  /** The environment variable that holds the webhook address. Default `DISCORD_WEBHOOK_URL`. */
  webhookEnv?: string;
  /** The most posts the site sends in an hour, 1 to 100. Default 30. */
  postsPerHour?: number;
  /** The language dates are written in (a BCP 47 tag). Default `en-GB`. */
  dateLocale?: string;
  /** Replaces any of the panel's and the post's words. */
  text?: Partial<DiscordText>;
  /** Where the panel sits among the editor's panels; lower comes first. Default 3. */
  order?: number;
}

export interface ResolvedOptions {
  collections: Record<string, { path: string; name: string }>;
  titleField: string;
  summaryField: string | null;
  imageField: string | null;
  taxonomy: string | null;
  termImages: Record<string, string>;
  defaultImage: string | null;
  colour: number | null;
  webhookEnv: string;
  postsPerHour: number;
  dateLocale: string;
  text: DiscordText;
  order: number;
}

const PREFIX = '@borislavhr/emdash-plugin-discord:';
const NAME = /^[a-z][a-z0-9_]*$/;
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/;

function picture(value: string, what: string): string {
  if (/^\/(?![/\\])/.test(value) || /^https:\/\/[^/]/.test(value)) return value;
  throw new Error(`${PREFIX} ${what} must be a site path ("/…") or an https address.`);
}

function field(value: string | null | undefined, fallback: string | null, what: string) {
  const resolved = value === undefined ? fallback : value;
  if (resolved !== null && !NAME.test(resolved)) {
    throw new Error(
      `${PREFIX} \`${what}\` must be a field name, such as "${fallback ?? 'title'}".`,
    );
  }
  return resolved;
}

/** Checks the options and fills in the defaults. Throws with a plain message on a mistake. */
export function resolveOptions(options: DiscordOptions = {}): ResolvedOptions {
  const given = options.collections ?? { posts: { path: '/posts/{slug}', name: 'post' } };
  if (Object.keys(given).length === 0) {
    throw new Error(`${PREFIX} \`collections\` needs at least one collection.`);
  }
  const collections: ResolvedOptions['collections'] = {};
  for (const [name, collection] of Object.entries(given)) {
    if (!NAME.test(name)) throw new Error(`${PREFIX} "${name}" is not a collection name.`);
    const path = collection?.path;
    if (typeof path !== 'string' || !path.startsWith('/') || /^\/[/\\]/.test(path)) {
      throw new Error(`${PREFIX} the path for "${name}" must start with a single "/".`);
    }
    if (path.split('{slug}').length !== 2) {
      throw new Error(`${PREFIX} the path for "${name}" must contain {slug} once.`);
    }
    collections[name] = { path, name: collection.name?.trim() || name };
  }

  const taxonomy = options.taxonomy ?? null;
  if (taxonomy !== null && !NAME.test(taxonomy)) {
    throw new Error(`${PREFIX} \`taxonomy\` must be a taxonomy name, such as "category".`);
  }
  const termImages: Record<string, string> = {};
  for (const [slug, image] of Object.entries(options.termImages ?? {})) {
    termImages[slug] = picture(image, `the picture for the term "${slug}"`);
  }

  let colour: number | null = null;
  if (options.colour !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(options.colour)) {
      throw new Error(`${PREFIX} \`colour\` must be written as #rrggbb.`);
    }
    colour = Number.parseInt(options.colour.slice(1), 16);
  }

  const webhookEnv = options.webhookEnv ?? 'DISCORD_WEBHOOK_URL';
  if (!ENV_NAME.test(webhookEnv)) {
    throw new Error(`${PREFIX} \`webhookEnv\` must be an environment variable name.`);
  }

  const postsPerHour = options.postsPerHour ?? 30;
  if (!Number.isInteger(postsPerHour) || postsPerHour < 1 || postsPerHour > 100) {
    throw new Error(`${PREFIX} \`postsPerHour\` must be a whole number from 1 to 100.`);
  }

  const dateLocale = options.dateLocale ?? 'en-GB';
  // A wrong language tag throws a RangeError here.
  new Date(0).toLocaleDateString(dateLocale);

  return {
    collections,
    titleField: field(options.titleField, 'title', 'titleField') ?? 'title',
    summaryField: field(options.summaryField, 'excerpt', 'summaryField'),
    imageField: field(options.imageField, 'featured_image', 'imageField'),
    taxonomy,
    termImages,
    defaultImage: options.defaultImage ? picture(options.defaultImage, '`defaultImage`') : null,
    colour,
    webhookEnv,
    postsPerHour,
    dateLocale,
    text: { ...DEFAULT_TEXT, ...options.text },
    order: options.order ?? 3,
  };
}
