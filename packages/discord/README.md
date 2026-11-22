# @borislavhr/emdash-plugin-discord

A short Discord post when an entry on your EmDash site is published **for the first time**. The
post has the entry's title as a link, its summary and its picture.

It's careful about when it posts:

- Corrections, republishing, imports and copies from another site are **never** posted as new.
- Nothing is posted until an admin switches it on.
- Editors can keep any single entry out of Discord.
- A failed post is tried again automatically.
- The post can't ping anyone, even if a title contains `@everyone`.

## What a post looks like

One Discord embed:

- **New post** (or **New guide**, **Updated story**: your collection's name), as the small line
  at the top
- **The entry's title**, linking to its page
- the summary, cut at a word to 300 characters
- the picture: the entry's own, else its term's, else a default one
- the first term of a taxonomy you choose (such as its category), at the bottom
- a coloured line down the side, if you set a colour

## When it posts

| What happens                                                     | What the plugin does                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| An entry is published for the first time                         | Posts it, once.                                                                                                  |
| A published entry is edited and published again                  | Nothing. EmDash keeps the first publish date, and an entry is posted only within 24 hours of it.                 |
| Entries are imported or copied from another site                 | Nothing: their first publish date is old.                                                                        |
| An editor presses **Post an update** (a day after the last post) | Posts it again, labelled "Updated …". For a real change, such as a new section; by hand only.                    |
| An entry published before posting was switched on                | Nothing on its own. **Post to Discord** in its panel posts it.                                                   |
| An editor chose **Don't post this one**                          | Never posted, not even when first published, until they choose **Post it after all**.                            |
| Discord can't be reached, or refuses                             | Tried again every 15 minutes, up to five times. Then the panel asks a person to press **Post again**.            |
| More than 30 posts in one hour                                   | The rest wait for the next hour and go out with the retries. Guards against a stuck button or a misused account. |
| Posting is switched off, or the webhook isn't set                | Nothing is posted.                                                                                               |

## What editors see

Each entry in the announced collections gets a **Discord** panel in the editor's sidebar. It
says, in plain words, whether the entry was posted and when, whether a post failed, or what will
happen when it's published. The buttons it shows depend on that state:

- **Post to Discord**: an entry published before posting began.
- **Post again**: a post that failed.
- **Post an update**: only from a day after the last post.
- **Don't post this one** / **Post it after all**.

To keep a new entry out of Discord: save it as a draft, choose **Don't post this one**, then
publish.

Anyone who can edit their own entries (Authors and above, permission `content:edit_own`) can use
the panel. The switch for the whole site, under **Plugins > Discord**, is for admins.

## Requirements

- **EmDash 1.5 or later** (1.x).
- The plugin runs as a **trusted plugin** (EmDash's `plugins: []` list). It isn't a sandboxed
  plugin and isn't in the EmDash marketplace.
- **A Discord webhook** for the channel, in the environment variable `DISCORD_WEBHOOK_URL`.
- **EmDash's cron** for the retries. Without it, a failed post waits for **Post again**.

## Install

```sh
pnpm add @borislavhr/emdash-plugin-discord
# or: npm install @borislavhr/emdash-plugin-discord
```

Add it to EmDash's `plugins` in `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import emdash from 'emdash/astro';
import { discord } from '@borislavhr/emdash-plugin-discord';

export default defineConfig({
  integrations: [
    emdash({
      // …your database, storage and other settings
      plugins: [
        discord({
          collections: {
            posts: { path: '/blog/{slug}', name: 'post' },
            guides: { path: '/guides/{slug}', name: 'guide' },
          },
          summaryField: 'excerpt',
          imageField: 'featured_image',
          taxonomy: 'category',
          defaultImage: '/og/default.jpg',
          colour: '#2f6f5e',
        }),
      ],
    }),
  ],
});
```

The options are checked when the site builds, so a mistake (a path without `{slug}`, a colour
written as `green`) stops the build with a plain message instead of failing at the first post.

## Set up the webhook

1. In Discord: **Server Settings > Integrations > Webhooks > New Webhook**. Choose the channel,
   give it a name and picture, and **Copy Webhook URL**.
2. Put the address in the site's environment as `DISCORD_WEBHOOK_URL`:
   - **Cloudflare Workers:** `npx wrangler secret put DISCORD_WEBHOOK_URL`, once for each Worker.
     For local development, put it in `.dev.vars`. The plugin reads it from `process.env`.
     Workers fill `process.env` with your secrets when `nodejs_compat` is on and the
     compatibility date is 2025-04-01 or later, which EmDash needs anyway.
   - **Node:** an environment variable, or your `.env` file.
3. Give a staging or test site a webhook for a **separate test channel**, so tests never reach
   your community.
4. When the site's first entries are in, an admin switches it on under **Plugins > Discord**.
   Switching it on later doesn't post anything that's already published.

Only an address of the form `https://discord.com/api/webhooks/<id>/<token>` counts as set up.
Anything else (another host, extra parameters) is ignored, so a wrong value can't send posts
somewhere else.

**Treat the webhook address as a password:** anyone who has it can post in that channel. Keep it
out of your repository and out of chats. If it leaks, delete the webhook in Discord, make a new
one and set the new address.

## Options

| Option         | Default                                              | What it does                                                                                                                                                                                          |
| -------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collections`  | `{ posts: { path: '/posts/{slug}', name: 'post' } }` | The collections that are announced. `path` is the address of an entry, with `{slug}`; `name` is what one entry is called ("guide"). Announce only pages people read, never anything visitors send in. |
| `titleField`   | `'title'`                                            | The field with the entry's title. An entry without a title isn't posted.                                                                                                                              |
| `summaryField` | `'excerpt'`                                          | The field with a short summary. `null`: no summary.                                                                                                                                                   |
| `imageField`   | `'featured_image'`                                   | The image field whose picture is shown. `null`: none.                                                                                                                                                 |
| `taxonomy`     | none                                                 | A taxonomy whose first term is shown at the bottom of the post, such as `'category'`.                                                                                                                 |
| `termImages`   | none                                                 | A picture for an entry without one, chosen by its term's slug: `{ recipes: '/og/recipes.jpg' }`.                                                                                                      |
| `defaultImage` | none                                                 | A picture for an entry with no picture of its own and none from its term.                                                                                                                             |
| `colour`       | Discord's                                            | The colour of the line down the side, as `#rrggbb`.                                                                                                                                                   |
| `webhookEnv`   | `'DISCORD_WEBHOOK_URL'`                              | The environment variable with the webhook address.                                                                                                                                                    |
| `postsPerHour` | `30`                                                 | The most posts the site sends in an hour, 1 to 100.                                                                                                                                                   |
| `dateLocale`   | `'en-GB'`                                            | The language of dates in the panel.                                                                                                                                                                   |
| `text`         | English                                              | Replaces any of the panel's and the post's words (below).                                                                                                                                             |
| `order`        | `3`                                                  | Where the panel sits among the editor's panels; lower comes first.                                                                                                                                    |

Pictures (`termImages`, `defaultImage`) are a site path (`/og/default.jpg`, made into a full
address on your site) or an `https://` address. An entry's own picture comes from its image
field: its `url` or `src`, or, for a file in EmDash's media library, EmDash's media address.

## Other languages

Every text in the panel and the post can be replaced. Only give the ones you change; the others
stay English:

```js
discord({
  collections: { posts: { path: '/blog/{slug}', name: 'artikel' } },
  dateLocale: 'de-DE',
  text: {
    newLabel: 'Neu: {kind}',
    updateLabel: 'Aktualisiert: {kind}',
    postNow: 'Auf Discord posten',
    // and the others
  },
});
```

`{kind}` is the collection's `name`, `{date}` a date, and `{setting}` the name of the webhook
setting. The default English texts are exported as `DEFAULT_TEXT`, so you can see every key.

## Privacy and security

- **Network:** only `discord.com` (the plugin's `allowedHosts`).
- **What is sent:** the published entry's title, summary, first term, page address and picture
  address. Never drafts, never other fields, never anything about readers or editors.
- **Mentions:** `allowed_mentions` is empty, so a post can't ping anyone, roles and `@everyone`
  included.
- **What is published:** the plugin always reads the live, published entry, never the draft, even
  from the panel.
- **Storage** (the plugin's own key-value store): for each entry, whether it was posted or failed,
  when, how many tries, and whether an editor chose not to post it; and this hour's post count.
  No text from the entries.
- **Logs:** statuses only, such as "Discord answered 429 to a post".
- **Capabilities:** `content:read`, `network:request`, and `taxonomies:read` when you set
  `taxonomy`.

## Good to know

- The plugin's id is `discord`. Its records are kept under that id, so keep it if you ever swap
  versions.
- Post to a **thread or forum channel**: not yet; only plain webhook addresses are accepted.
- Retries are every 15 minutes, up to five times; updates wait 24 hours after the last post.
  These are fixed on purpose, so a channel stays calm.

## Development

This package lives in the [emdash-plugins](https://github.com/BorislavHr/emdash-plugins)
repository.

```sh
pnpm install
pnpm --filter @borislavhr/emdash-plugin-discord test
pnpm --filter @borislavhr/emdash-plugin-discord build
```

## License

[MIT](./LICENSE)
