// IndexNow: a trusted EmDash plugin that tells search engines when a public page changes, so
// Bing, Yandex, Seznam, Naver and the others look again within minutes. Google doesn't take
// IndexNow and reads the sitemap instead.
//
// - content:afterPublish and content:afterUnpublish: a notice for the entry's page and the pages
//   that list it (publishing again after an edit is a publish too).
// - content:beforeDelete notes the addresses of a live entry, and content:afterDelete sends them:
//   once deleted, the entry can no longer be read.
// - Sends only when `enabled` is true AND the site runs at `siteUrl`: never from staging, a
//   preview or a local copy at another address, even with the same settings.
// - Network: only the endpoint's host (api.indexnow.org unless set otherwise). Only public
//   addresses of the site's pages are sent, never drafts, words from an entry or anything about
//   the editor. A failed notice is logged by status only and changes nothing: the sitemap still
//   has the page.
import { definePlugin, type PluginContext } from 'emdash';

import { isLiveSite, keyFrom, noticeBody, pathsFor } from './notify.ts';
import { resolveOptions, type IndexNowOptions, type ResolvedOptions } from './options.ts';
import { VERSION } from './version.ts';

const PLUGIN_ID = 'indexnow';

const deletingKey = (collection: string, id: string) => `deleting:${collection}:${id}`;

interface Entry {
  id?: unknown;
  slug?: unknown;
  data?: unknown;
}

function createRuntime(options: ResolvedOptions) {
  async function termsOf(ctx: PluginContext, collection: string, id: string) {
    const taxonomy = options.collections[collection]?.terms?.taxonomy;
    if (!taxonomy) return [];
    try {
      const terms = await ctx.taxonomies?.getEntryTerms(collection, id, { taxonomy });
      return (terms ?? []).map((term) => term.slug);
    } catch {
      return [];
    }
  }

  async function pathsOf(ctx: PluginContext, collection: string, entry: Entry) {
    const settings = options.collections[collection];
    if (!settings) return [];
    const data = (entry.data ?? {}) as { slug?: unknown };
    const slug = typeof entry.slug === 'string' ? entry.slug : data.slug;
    const id = typeof entry.id === 'string' ? entry.id : undefined;
    return pathsFor({
      collection: settings,
      slug,
      terms: id ? await termsOf(ctx, collection, id) : [],
    });
  }

  /** Whether this site may send at all: switched on, with a key, at its public address. */
  function sendable(ctx: PluginContext): string | undefined {
    if (!options.enabled || !ctx.http) return undefined;
    let current: string;
    try {
      current = ctx.url('/');
    } catch {
      return undefined;
    }
    if (!isLiveSite(current, options.site)) return undefined;
    return keyFrom(options.key, options.keyEnv);
  }

  async function notify(ctx: PluginContext, paths: readonly string[]) {
    const key = sendable(ctx);
    if (!key || paths.length === 0 || !ctx.http) return;
    try {
      const response = await ctx.http.fetch(options.endpoint.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(noticeBody(options.site, key, options.keyLocation, paths)),
      });
      // 200 and 202 both mean "received". Anything else: the status only.
      if (!response.ok) ctx.log.warn(`IndexNow answered ${response.status}`);
    } catch (error) {
      ctx.log.warn(
        `IndexNow could not be reached: ${error instanceof Error ? error.name : 'error'}`,
      );
    }
  }

  return { pathsOf, notify, sendable };
}

export function createPlugin(input: IndexNowOptions) {
  const options = resolveOptions(input);
  const runtime = createRuntime(options);
  const usesTerms = Object.values(options.collections).some((collection) => collection.terms);
  return definePlugin({
    id: PLUGIN_ID,
    version: VERSION,
    capabilities: [
      'content:read',
      ...(usesTerms ? (['taxonomies:read'] as const) : []),
      'network:request',
    ],
    allowedHosts: [options.endpoint.host],
    hooks: {
      'content:afterPublish': async (event, ctx) => {
        await runtime.notify(ctx, await runtime.pathsOf(ctx, event.collection, event.content));
      },
      'content:afterUnpublish': async (event, ctx) => {
        await runtime.notify(ctx, await runtime.pathsOf(ctx, event.collection, event.content));
      },
      'content:beforeDelete': async (event, ctx) => {
        if (!options.collections[event.collection] || !runtime.sendable(ctx)) return;
        const entry = await ctx.content?.get(event.collection, event.id);
        if (!entry || entry.status !== 'published') return;
        const paths = await runtime.pathsOf(ctx, event.collection, entry);
        if (paths.length > 0) await ctx.kv.set(deletingKey(event.collection, event.id), paths);
      },
      'content:afterDelete': async (event, ctx) => {
        const key = deletingKey(event.collection, event.id);
        const paths = await ctx.kv.get<string[]>(key);
        if (!paths) return;
        await ctx.kv.delete(key);
        await runtime.notify(ctx, paths);
      },
    },
  });
}
