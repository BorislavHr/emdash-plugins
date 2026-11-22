// Discord announcements: a trusted EmDash plugin that posts a short message to a Discord channel
// when an entry goes live for the first time.
//
// - content:afterPublish: posts once per entry, and only when the entry was first published within
//   the last day (EmDash keeps the first publish date on republishing, imports and copies from
//   another site, so corrections and a first content load are never posted as new).
// - Settings (Plugins > Discord): one switch, off until an admin turns it on. While it is off,
//   nothing is posted.
// - Editor panel "Discord" on the chosen collections: whether the entry was posted, and the
//   buttons "Post to Discord" (an entry published before posting began), "Post again" (a post that
//   failed) and "Post an update" (a real change, by hand only). "Don't post this one" keeps an
//   entry out of Discord before it is posted, without pausing posting for everything else; "Post
//   it after all" undoes it.
// - cron "retry": a failed post is tried again every 15 minutes, up to five times; the task is
//   scheduled when a post fails and cancelled when nothing is waiting.
//
// Network: only discord.com. What is sent: the published entry's title, summary, first term, its
// address and its picture's address, nothing else: never drafts, names or anything about readers
// or editors. The post can't mention anyone (allowed_mentions is empty).
// Secret: the webhook address, from the environment (DISCORD_WEBHOOK_URL unless set otherwise).
// Where it is missing, nothing is posted and the panel says so. Storage: per entry, what kind of
// post was sent, when, and whether it failed, and whether an editor chose not to post it; and a
// count of this hour's posts. Logs: statuses only.
import { definePlugin, type PluginContext, type RouteContext } from 'emdash';

import { fileHref } from './files.ts';
import {
  MAX_ATTEMPTS,
  RETRY_SCHEDULE,
  canPost,
  canPostUpdate,
  isNew,
  message,
  pagePath,
  panelState,
  webhookFrom,
  type PanelState,
  type PostRecord,
} from './message.ts';
import { resolveOptions, type DiscordOptions, type ResolvedOptions } from './options.ts';
import { format } from './text.ts';
import { VERSION } from './version.ts';

const PLUGIN_ID = 'discord';
const RETRY_TASK = 'retry';

interface Entry {
  id?: unknown;
  slug?: unknown;
  status?: unknown;
  publishedAt?: unknown;
  data?: unknown;
}

/**
 * How a send ended: posted; failed (Discord refused or couldn't be reached); limit (this hour's
 * share is used, so it waits for the retry task); skipped (nothing to post: not published, no
 * title or address, or posting isn't set up).
 */
type SendResult = 'posted' | 'failed' | 'limit' | 'skipped';

const recordKey = (collection: string, id: string) => `post:${collection}:${id}`;
const skipKey = (collection: string, id: string) => `skip:${collection}:${id}`;
const hourKey = () => `sent:${new Date().toISOString().slice(0, 13)}`;

async function isOn(ctx: PluginContext): Promise<boolean> {
  return (await ctx.settings.get<boolean>('on')) === true;
}

async function isSkipped(ctx: PluginContext, collection: string, id: string): Promise<boolean> {
  return (await ctx.kv.get<boolean>(skipKey(collection, id))) === true;
}

async function countPost(ctx: PluginContext) {
  const key = hourKey();
  const count = (await ctx.kv.get<number>(key)) ?? 0;
  for (const old of await ctx.kv.list('sent:')) {
    if (old.key !== key) await ctx.kv.delete(old.key);
  }
  await ctx.kv.set(key, count + 1);
}

/** A site address made absolute; a full https address as it is; anything else nothing. */
function absolute(ctx: PluginContext, href: string | null | undefined): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('/') && !href.startsWith('//')) return ctx.url(href);
  return /^https:\/\//.test(href) ? href : undefined;
}

function createRuntime(options: ResolvedOptions) {
  const { text } = options;
  const webhook = () => webhookFrom(options.webhookEnv);
  const isCollection = (name: string) => Object.hasOwn(options.collections, name);
  const kindOf = (collection: string) => options.collections[collection]?.name ?? collection;

  async function firstTerm(ctx: PluginContext, collection: string, id: string) {
    if (!options.taxonomy) return undefined;
    try {
      const terms = await ctx.taxonomies?.getEntryTerms(collection, id, {
        taxonomy: options.taxonomy,
      });
      return terms?.[0];
    } catch {
      return undefined;
    }
  }

  async function underHourlyLimit(ctx: PluginContext): Promise<boolean> {
    return ((await ctx.kv.get<number>(hourKey())) ?? 0) < options.postsPerHour;
  }

  /** Posts one entry: its own picture, else its term's, else the default one. */
  async function send(
    ctx: PluginContext,
    collection: string,
    entry: Entry,
    kind: PostRecord['kind'],
  ): Promise<SendResult> {
    const url = webhook();
    const id = typeof entry.id === 'string' ? entry.id : undefined;
    const path = pagePath(options.collections[collection]?.path, entry.slug);
    const data = (entry.data ?? {}) as Record<string, unknown>;
    const rawTitle = data[options.titleField];
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    if (!url || !ctx.http || !id || !path || !title || entry.status !== 'published') {
      return 'skipped';
    }

    const key = recordKey(collection, id);
    const before = await ctx.kv.get<PostRecord>(key);
    const term = await firstTerm(ctx, collection, id);
    const summary = options.summaryField ? data[options.summaryField] : undefined;
    const picture =
      (options.imageField ? absolute(ctx, fileHref(data[options.imageField])) : undefined) ??
      absolute(ctx, term?.slug ? options.termImages[term.slug] : undefined) ??
      absolute(ctx, options.defaultImage);
    const body = message({
      label: format(kind === 'new' ? text.newLabel : text.updateLabel, {
        kind: kindOf(collection),
      }),
      title,
      summary: typeof summary === 'string' ? summary : undefined,
      href: ctx.url(path),
      picture,
      term: term?.label,
      colour: options.colour,
    });

    // Checked again here, at the last moment: "Don't post this one" may have been pressed while
    // this post was on its way (the publish hook, a retry or a button).
    if (await isSkipped(ctx, collection, id)) return 'skipped';

    let ok = false;
    const room = await underHourlyLimit(ctx);
    if (room) {
      try {
        const response = await ctx.http.fetch(`${url}?wait=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        ok = response.ok;
        if (!ok) ctx.log.warn(`Discord answered ${response.status} to a post`);
      } catch (error) {
        ctx.log.warn(
          `Discord could not be reached: ${error instanceof Error ? error.name : 'error'}`,
        );
      }
    }

    const at = new Date().toISOString();
    if (ok) {
      await countPost(ctx);
      await ctx.kv.set(key, { kind, at, status: 'posted' } satisfies PostRecord);
      // A post went out: a choice not to post can no longer apply, so it can't block an update.
      await ctx.kv.delete(skipKey(collection, id));
      return 'posted';
    }
    // Waiting for the next hour is not a failed try.
    const earlier = before?.status === 'failed' ? (before.attempts ?? 0) : 0;
    const attempts = room ? earlier + 1 : earlier;
    await ctx.kv.set(key, { kind, at, status: 'failed', attempts } satisfies PostRecord);
    if (attempts < MAX_ATTEMPTS) {
      await ctx.cron?.schedule(RETRY_TASK, { schedule: RETRY_SCHEDULE }).catch(() => undefined);
    }
    return room ? 'failed' : 'limit';
  }

  /** The cron task: tries failed posts again, and stops itself when nothing is waiting. */
  async function retry(ctx: PluginContext) {
    let waiting = 0;
    for (const item of await ctx.kv.list('post:')) {
      const record = item.value as PostRecord;
      if (record.status !== 'failed' || (record.attempts ?? 0) >= MAX_ATTEMPTS) continue;
      const [, collection, id] = item.key.split(':');
      if (!collection || !id || !isCollection(collection)) continue;
      // An editor chose not to post it since it failed: nothing to try again.
      if (await isSkipped(ctx, collection, id)) {
        await ctx.kv.delete(item.key);
        continue;
      }
      const entry = await ctx.content?.get(collection, id);
      // Unpublished or deleted since: nothing to announce any more.
      if (!entry || entry.status !== 'published') {
        await ctx.kv.delete(item.key);
        continue;
      }
      const result = await send(ctx, collection, entry, record.kind);
      if (result === 'failed' || result === 'limit') {
        const after = await ctx.kv.get<PostRecord>(item.key);
        if ((after?.attempts ?? 0) < MAX_ATTEMPTS) waiting += 1;
      }
    }
    if (waiting === 0) await ctx.cron?.cancel(RETRY_TASK).catch(() => undefined);
  }

  /** "Don't post this one", offered while nothing has gone out. */
  const skipBlocks = [
    { type: 'actions', elements: [{ type: 'button', action_id: 'skip', label: text.skip }] },
    { type: 'context', text: text.skipNote },
  ];

  function stateBlocks(state: PanelState, kind: string) {
    const when = (at: string) =>
      new Date(at).toLocaleDateString(options.dateLocale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    switch (state.kind) {
      case 'notConnected':
        return [
          { type: 'section', text: format(text.notConnected, { setting: options.webhookEnv }) },
        ];
      case 'off':
        return [{ type: 'section', text: text.off }, ...skipBlocks];
      case 'skipped':
        return [
          { type: 'section', text: format(text.skipped, { kind }) },
          {
            type: 'actions',
            elements: [{ type: 'button', action_id: 'unskip', label: text.unskip }],
          },
        ];
      case 'waiting':
        return [{ type: 'section', text: format(text.waiting, { kind }) }, ...skipBlocks];
      case 'notPosted':
        return [
          { type: 'section', text: format(text.notPosted, { kind }) },
          {
            type: 'actions',
            elements: [{ type: 'button', action_id: 'post', label: text.postNow }],
          },
          ...skipBlocks,
        ];
      case 'posted':
        return [
          {
            type: 'section',
            text: format(state.update ? text.updatePosted : text.posted, { date: when(state.at) }),
          },
          ...(state.canUpdate
            ? [
                {
                  type: 'actions',
                  elements: [{ type: 'button', action_id: 'update', label: text.postUpdate }],
                },
                { type: 'context', text: text.updateNote },
              ]
            : [{ type: 'context', text: text.updateLater }]),
        ];
      case 'failed':
        return [
          { type: 'banner', variant: 'error', title: state.gaveUp ? text.gaveUp : text.failed },
          {
            type: 'actions',
            elements: [
              { type: 'button', action_id: 'post', label: text.postAgain, style: 'primary' },
            ],
          },
          ...skipBlocks,
        ];
    }
  }

  async function panel(ctx: RouteContext) {
    const entry = ctx.ui && 'entry' in ctx.ui ? ctx.ui.entry : undefined;
    if (!entry || !isCollection(entry.collection)) return { blocks: [] };
    const collection = entry.collection;
    const input = (ctx.input ?? {}) as { action_id?: string };
    const key = recordKey(collection, entry.id);
    const connected = webhook() !== undefined;
    const on = await isOn(ctx);
    // The live entry: the plugin reads what is published, never the draft.
    const saved = await ctx.content?.get(collection, entry.id);
    const published = saved?.status === 'published';
    let toast: { message: string; type: 'success' | 'error' } | undefined;

    // Choosing not to post works whether posting is on or not, so it can be set before it is.
    if (connected && (input.action_id === 'skip' || input.action_id === 'unskip')) {
      const before = await ctx.kv.get<PostRecord>(key);
      if (input.action_id === 'unskip') {
        await ctx.kv.delete(skipKey(collection, entry.id));
      } else if (before?.status !== 'posted') {
        await ctx.kv.set(skipKey(collection, entry.id), true);
        // A failed post waiting for its next try is dropped too.
        if (before) await ctx.kv.delete(key);
      }
    }
    const skipped = await isSkipped(ctx, collection, entry.id);

    if (connected && on && saved && published && !skipped) {
      const before = await ctx.kv.get<PostRecord>(key);
      // "Post to Discord" and "Post again" never repeat a post that went out; an update waits a
      // day after the last post. Pressing a button the panel no longer shows changes nothing.
      const kind =
        input.action_id === 'post' && canPost(before, skipped)
          ? (before?.kind ?? 'new')
          : input.action_id === 'update' && canPostUpdate(before, new Date())
            ? 'update'
            : undefined;
      if (kind) {
        const result = await send(ctx, collection, saved, kind);
        toast =
          result === 'posted'
            ? { message: text.done, type: 'success' }
            : { message: result === 'limit' ? text.tooMany : text.notDone, type: 'error' };
      }
    }

    const record = await ctx.kv.get<PostRecord>(key);
    const state = panelState({ connected, on, published, record, skipped, now: new Date() });
    return {
      blocks: stateBlocks(state, kindOf(collection)),
      ...(toast ? { toast } : {}),
    };
  }

  return { webhook, isCollection, send, retry, panel };
}

export function createPlugin(input: DiscordOptions = {}) {
  const options = resolveOptions(input);
  const runtime = createRuntime(options);
  return definePlugin({
    id: PLUGIN_ID,
    version: VERSION,
    capabilities: [
      'content:read',
      ...(options.taxonomy ? (['taxonomies:read'] as const) : []),
      'network:request',
    ],
    allowedHosts: ['discord.com'],
    hooks: {
      'content:afterPublish': async (event, ctx) => {
        if (!runtime.isCollection(event.collection) || !runtime.webhook() || !(await isOn(ctx))) {
          return;
        }
        const entry = event.content as Entry;
        if (typeof entry.id !== 'string' || !isNew(entry.publishedAt, new Date())) return;
        // Once per entry: a later publish of the same entry is never posted again on its own.
        if (await ctx.kv.get(recordKey(event.collection, entry.id))) return;
        if (await isSkipped(ctx, event.collection, entry.id)) return;
        await runtime.send(ctx, event.collection, entry, 'new');
      },
      cron: async (event, ctx) => {
        if (event.name === RETRY_TASK) await runtime.retry(ctx);
      },
    },
    routes: {
      panel: { permission: 'content:edit_own' as const, handler: runtime.panel },
    },
    admin: {
      settingsSchema: {
        on: {
          type: 'boolean',
          label: options.text.settingOn,
          description: options.text.settingOnNote,
          default: false,
        },
      },
      editorPanels: [
        {
          id: PLUGIN_ID,
          title: options.text.panelTitle,
          route: 'panel',
          collections: Object.keys(options.collections),
          order: options.order,
        },
      ],
    },
  });
}
