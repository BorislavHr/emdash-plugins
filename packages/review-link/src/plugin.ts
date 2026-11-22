// Review link: a trusted EmDash plugin that gives an editor a private link to an entry's draft
// that works for days (7 unless set otherwise), so someone without an admin account can review
// it. The admin's own Preview link lasts an hour.
//
// - Editor panel "Review link" on the chosen collections, with one button. The link is shown
//   once, in the panel, and kept nowhere: not in storage, not in logs.
// - The link is EmDash's own signed preview link (`?_preview=`), so EmDash checks it, shows the
//   current draft, and keeps it out of caches and search engines, as with its one-hour links.
// - Secret: EMDASH_PREVIEW_SECRET in the environment, which EmDash also signs and checks its
//   preview links with. Without it the panel says it isn't set up and offers no button.
//   Changing it ends every preview and review link at once.
//
// Network: none. Storage: none. Permission: Authors and above (content:edit_own).
import { definePlugin, type RouteContext } from 'emdash';

import { makeReviewLink, previewSecret, reviewPath } from './link.ts';
import { resolveOptions, type ResolvedOptions, type ReviewLinkOptions } from './options.ts';
import { format } from './text.ts';
import { VERSION } from './version.ts';

const PLUGIN_ID = 'review-link';

interface EditorInput {
  action_id?: string;
}

function panelHandler(options: ResolvedOptions) {
  const { text } = options;
  const when = (at: Date) =>
    at.toLocaleString(options.dateLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: options.timeZone,
      timeZoneName: 'short',
    });

  return async function panel(ctx: RouteContext) {
    const entry = ctx.ui && 'entry' in ctx.ui ? ctx.ui.entry : undefined;
    const pattern = entry ? options.collections[entry.collection] : undefined;
    if (!entry || !pattern) return { blocks: [] };
    const blocks: unknown[] = [
      { type: 'section', text: format(text.about, { days: options.days }) },
    ];

    const secret = previewSecret();
    if (!secret) {
      blocks.push({ type: 'context', text: text.notConnected });
      return { blocks };
    }

    const saved = (await ctx.content?.get(entry.collection, entry.id)) as
      { slug?: unknown } | null | undefined;
    const path = reviewPath(pattern, saved?.slug);
    if (!path) {
      blocks.push({ type: 'context', text: text.saveFirst });
      return { blocks };
    }

    const input = (ctx.input ?? {}) as EditorInput;
    let made = false;
    let toast: { message: string; type: 'error' } | undefined;
    if (input.action_id === 'make') {
      try {
        const link = await makeReviewLink({
          collection: entry.collection,
          id: entry.id,
          path,
          secret,
          base: ctx.url('/'),
          days: options.days,
        });
        blocks.push(
          {
            type: 'banner',
            variant: 'default',
            title: format(text.made, { date: when(link.expires) }),
          },
          { type: 'code', code: link.url },
          { type: 'context', text: text.copy },
        );
        made = true;
      } catch {
        toast = { message: text.failed, type: 'error' };
      }
    }

    blocks.push(
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'make',
            label: made ? text.makeAnother : text.make,
            style: made ? undefined : 'primary',
          },
        ],
      },
      { type: 'context', text: text.rules },
    );
    return { blocks, ...(toast ? { toast } : {}) };
  };
}

export function createPlugin(input: ReviewLinkOptions = {}) {
  const options = resolveOptions(input);
  return definePlugin({
    id: PLUGIN_ID,
    version: VERSION,
    capabilities: ['content:read'],
    routes: {
      panel: { permission: 'content:edit_own' as const, handler: panelHandler(options) },
    },
    admin: {
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
