// What the plugin posts and when, as plain functions so they can be tested without EmDash or
// Discord.

/**
 * An entry counts as new when it was first published within this time. EmDash keeps the first
 * publish date when an entry is published again, imported or copied from another site, so a
 * correction, a republish or a first content load is never posted as new.
 */
export const NEW_WITHIN_HOURS = 24;

export function isNew(publishedAt: unknown, now: Date): boolean {
  if (typeof publishedAt !== 'string') return false;
  const first = Date.parse(publishedAt);
  if (Number.isNaN(first)) return false;
  const age = now.getTime() - first;
  // A little leeway for clocks: a date slightly in the future is still "just now".
  return age > -5 * 60_000 && age <= NEW_WITHIN_HOURS * 3_600_000;
}

/**
 * A Discord webhook address: only Discord's own, with nothing else in it. Anything else is
 * treated as not set up, so a wrong value can't send the post somewhere else.
 */
export function isWebhook(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^https:\/\/discord\.com\/api\/webhooks\/\d{5,30}\/[\w-]{20,100}$/.test(value)
  );
}

/** The webhook address from the environment, or undefined where it isn't set up. */
export function webhookFrom(
  name: string,
  env: Record<string, string | undefined> | undefined = globalThis.process?.env,
): string | undefined {
  const value = env?.[name]?.trim();
  return isWebhook(value) ? value : undefined;
}

/**
 * The entry's address on the site from the collection's pattern, or undefined when it has no
 * usable slug. A slug that could leave its path ("..", a slash, "?", "#", "%") gets none.
 */
export function pagePath(pattern: string | undefined, slug: unknown): string | undefined {
  if (!pattern || typeof slug !== 'string') return undefined;
  if (slug.length === 0 || slug.length > 200 || slug === '.' || slug === '..') return undefined;
  if (/[\s/\\?#%]/.test(slug)) return undefined;
  return pattern.replace('{slug}', encodeURIComponent(slug));
}

/** One post that was sent, or one that is waiting to be sent again. No text, only what and when. */
export interface PostRecord {
  kind: 'new' | 'update';
  /** When it was posted, or when it last failed (ISO). */
  at: string;
  status: 'posted' | 'failed';
  /** Failed tries so far. */
  attempts?: number;
}

/** A failed post is tried again by the cron task this many times, then waits for a person. */
export const MAX_ATTEMPTS = 5;
export const RETRY_SCHEDULE = '*/15 * * * *';

export interface PostInput {
  /** The small line above the title, such as "New guide". */
  label: string;
  title: string;
  summary?: string;
  /** Full address of the page. */
  href: string;
  /** Full address of the picture, if there is one. */
  picture?: string;
  /** The entry's first term in the chosen taxonomy, as readers see it. */
  term?: string;
  /** The colour of the line down the side, as a number; Discord's own when missing. */
  colour?: number | null;
}

/** Cuts long text at a word, so a post stays short. */
export function shorten(text: string, limit: number): string {
  const plain = text.replaceAll(/\s+/g, ' ').trim();
  if (plain.length <= limit) return plain;
  const cut = plain.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

/**
 * The webhook's message: one embed with the label ("New guide"), the title as a link, the
 * summary, the term and the picture. It can never mention anyone: allowed_mentions is empty, so
 * even "@everyone" typed in a title stays plain text.
 */
export function message(input: PostInput) {
  const summary = input.summary ? shorten(input.summary, 300) : '';
  return {
    allowed_mentions: { parse: [] as string[] },
    embeds: [
      {
        author: { name: shorten(input.label, 100) },
        title: shorten(input.title, 250),
        url: input.href,
        ...(summary ? { description: summary } : {}),
        ...(typeof input.colour === 'number' ? { color: input.colour } : {}),
        ...(input.term ? { footer: { text: shorten(input.term, 100) } } : {}),
        ...(input.picture ? { image: { url: input.picture } } : {}),
      },
    ],
  };
}

/** An update can follow the last post only after this long, so the channel stays calm. */
export const UPDATE_AFTER_HOURS = 24;

export function canPostUpdate(record: PostRecord | null, now: Date): boolean {
  if (record?.status !== 'posted') return false;
  return now.getTime() - Date.parse(record.at) >= UPDATE_AFTER_HOURS * 3_600_000;
}

/** Whether "Post to Discord" may send: never for an entry already posted, or one an editor chose
 * not to post ("Don't post this one"). */
export function canPost(record: PostRecord | null, skipped = false): boolean {
  return !skipped && record?.status !== 'posted';
}

/** What the editor panel says about one entry. */
export type PanelState =
  | { kind: 'notConnected' }
  | { kind: 'off' }
  | { kind: 'skipped' }
  | { kind: 'waiting' }
  | { kind: 'notPosted' }
  | { kind: 'posted'; at: string; update: boolean; canUpdate: boolean }
  | { kind: 'failed'; gaveUp: boolean };

export function panelState(input: {
  connected: boolean;
  on: boolean;
  published: boolean;
  record: PostRecord | null;
  /** An editor chose "Don't post this one". */
  skipped?: boolean;
  now: Date;
}): PanelState {
  if (!input.connected) return { kind: 'notConnected' };
  const { record } = input;
  // A post that went out stays the answer; choosing not to post only matters before that.
  if (input.skipped && record?.status !== 'posted') return { kind: 'skipped' };
  if (!input.on) return { kind: 'off' };
  if (record?.status === 'failed') {
    return { kind: 'failed', gaveUp: (record.attempts ?? 0) >= MAX_ATTEMPTS };
  }
  if (record?.status === 'posted') {
    return {
      kind: 'posted',
      at: record.at,
      update: record.kind === 'update',
      canUpdate: canPostUpdate(record, input.now),
    };
  }
  return input.published ? { kind: 'notPosted' } : { kind: 'waiting' };
}
