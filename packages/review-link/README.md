# @borislavhr/emdash-plugin-review-link

A private link to an entry's draft that works for days instead of an hour, so someone without an
admin account can review it. Example reviewers: an expert checking an article, a client approving
a page, or a translator.

EmDash's own **Preview** button makes a link that stops working after one hour. That's fine for
the editor, but too short for someone outside the team who reads the draft tomorrow. This plugin
adds a **Review link** panel to the entry editor. One click gives a link that works for 7 days (or
the number of days you choose, up to 30).

The link is EmDash's own signed preview link with a later end date. EmDash checks it, shows the
current draft, and treats the request as a preview, exactly as it does for its one-hour links. The
plugin adds no route, stores nothing and makes no network requests.

## What editors see

On every entry in the collections you choose, the editor's sidebar gets a **Review link** panel:

1. **Make a review link** creates the link. The panel shows it once, with the date and time it
   stops working.
2. The editor copies the link and sends it to the reviewer. The link isn't kept anywhere: to send
   it again, they make another one.
3. Whoever opens the link sees the draft **as it is at that moment**. Changes made after the link
   was sent show up the next time the reviewer opens it. There's no need to send a new link after
   each edit.

If the site isn't set up yet (see [Set the preview secret](#set-the-preview-secret)), the panel
says so and offers no button. If the entry has no slug yet, it asks the editor to save the draft
first.

Anyone who can edit their own entries (Authors and above, permission `content:edit_own`) can make
a review link.

## Requirements

- **EmDash 1.5 or later** (1.x).
- The plugin runs as a **trusted plugin** (EmDash's `plugins: []` list). It isn't a sandboxed
  plugin and isn't in the EmDash marketplace.
- **`EMDASH_PREVIEW_SECRET`** must be set in the site's environment (below).
- Your page templates load entries through EmDash's own functions (`getEmDashEntry` and the
  others). Those honour the `?_preview=` token, as they do for EmDash's own preview links.

## Install

```sh
pnpm add @borislavhr/emdash-plugin-review-link
# or: npm install @borislavhr/emdash-plugin-review-link
```

Add it to EmDash's `plugins` in `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import emdash from 'emdash/astro';
import { reviewLink } from '@borislavhr/emdash-plugin-review-link';

export default defineConfig({
  integrations: [
    emdash({
      // …your database, storage and other settings
      plugins: [
        reviewLink({
          // Which collections get the panel, and where their entries live on the site.
          collections: {
            posts: '/blog/{slug}',
            pages: '/{slug}',
          },
          days: 7,
        }),
      ],
    }),
  ],
});
```

The options are checked when the site builds, so a mistake (a path without `{slug}`, `days: 90`)
stops the build with a plain message instead of failing later in the editor.

## Set the preview secret

EmDash signs and checks preview links with a secret. When `EMDASH_PREVIEW_SECRET` (or
`PREVIEW_SECRET`) is set in the environment, EmDash uses it. Otherwise EmDash makes a secret of
its own and keeps it in the database, where a plugin can't read it. So this plugin needs the
environment variable, and with it EmDash and the plugin sign with the same secret.

Make a random value of at least 32 characters (64 is better):

```sh
openssl rand -hex 32
# or: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Then set it where the site runs:

- **Cloudflare Workers:** `npx wrangler secret put EMDASH_PREVIEW_SECRET`, once for each Worker
  (staging and production get different values). For local development, put it in `.dev.vars`.
  EmDash and this plugin read it from `process.env`. Workers fill `process.env` with your secrets
  when `nodejs_compat` is on and the compatibility date is 2025-04-01 or later, which EmDash needs
  anyway.
- **Node:** an environment variable, or your `.env` file.

Keep the value out of your repository and out of chats.

Setting the secret for the first time replaces the one EmDash kept in the database, so any
EmDash preview links that are open at that moment stop working. That's harmless: the editor
presses Preview again.

## Options

| Option        | Default                      | What it does                                                                                                                      |
| ------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `collections` | `{ posts: '/posts/{slug}' }` | The collections that get the panel, each with the address of its entries on the site. `{slug}` is replaced with the entry's slug. |
| `days`        | `7`                          | How long a link works: a whole number from 1 to 30.                                                                               |
| `dateLocale`  | `'en-GB'`                    | The language the end date is written in, such as `'de-DE'` or `'en-US'`.                                                          |
| `timeZone`    | `'UTC'`                      | The time zone of the end date, such as `'Europe/Berlin'`.                                                                         |
| `text`        | English                      | Replaces any of the panel's words (below).                                                                                        |
| `order`       | `4`                          | Where the panel sits among the editor's panels; lower comes first.                                                                |

The slug is put into the address with `encodeURIComponent`. An entry whose slug contains a slash,
`?`, `#`, `%` or white space, or is `.` or `..`, gets no link, so a link can't point outside the
entry's own path.

## Other languages

Every text in the panel can be replaced. Only give the ones you change; the others stay English:

```js
reviewLink({
  collections: { posts: '/blog/{slug}' },
  dateLocale: 'nl-NL',
  timeZone: 'Europe/Amsterdam',
  text: {
    panelTitle: 'Reviewlink',
    about: 'Een privélink naar dit concept voor iemand zonder account. Hij werkt {days} dagen.',
    make: 'Maak een reviewlink',
    makeAnother: 'Maak nog een link',
    made: 'Reviewlink gemaakt. Hij werkt tot {date}.',
    // copy, rules, saveFirst, notConnected, failed
  },
});
```

`{days}` and `{date}` are filled in. The default English texts are exported as `DEFAULT_TEXT`, so
you can see every key.

## Taking a link back

A review link can't be cancelled on its own: it's a signed token, and the site keeps no list of
the links it made. To end links early, **change `EMDASH_PREVIEW_SECRET`**. That ends every
preview and review link at once, on that site. Editors then make new links for the reviewers who
still need them.

So choose `days` with that in mind. The default of 7 suits most reviews; 30 is the upper limit on
purpose.

## Privacy and security

- **Who can read the draft:** anyone who has the link, until it ends. Send it to one person, by a
  private channel.
- **What it shows:** the current draft of that one entry, never other entries.
- **Network:** none. **Storage:** none. **Logs:** none. The link is shown once in the panel and
  isn't saved.
- **Capabilities:** `content:read`, to read the entry's slug.
- **Permission:** the panel's route needs `content:edit_own` (Authors and above).
- A short or placeholder secret (under 32 characters) counts as not set up, so the plugin never
  signs links with one.

## Development

This package lives in the [emdash-plugins](https://github.com/BorislavHr/emdash-plugins)
repository.

```sh
pnpm install
pnpm --filter @borislavhr/emdash-plugin-review-link test
pnpm --filter @borislavhr/emdash-plugin-review-link build
```

## License

[MIT](./LICENSE)
