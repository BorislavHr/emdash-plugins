# @borislavhr/emdash-plugin-indexnow

Tells search engines through [IndexNow](https://www.indexnow.org) when a page on your EmDash site
is published, unpublished or deleted. Bing, Yandex, Seznam, Naver and the other engines that take
IndexNow then look again within minutes, instead of whenever they next crawl. Google doesn't take
IndexNow; it reads your sitemap.

Besides the entry's own page, the notice includes the pages that list it, such as the blog's front
page or its category pages. Notices are sent **only from the live site**: never from staging, a
preview or a copy on your laptop, even with the same settings.

## When it sends

| What happens                                            | What is sent                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| An entry is published, or published again after an edit | Its page, the pages in `also`, and its term pages.                                                   |
| A published entry is unpublished                        | The same addresses, so search engines see it's gone.                                                 |
| A published entry is deleted                            | The same addresses. They are noted just before the delete, since afterwards the entry can't be read. |
| A scheduled entry goes live                             | Sent then, when EmDash publishes it.                                                                 |
| A draft is saved                                        | Nothing.                                                                                             |
| An entry in a collection you didn't list                | Nothing.                                                                                             |

A notice is sent only when **all** of these hold:

1. `enabled` is `true`;
2. the site is running at `siteUrl` (the address EmDash gives the plugin is compared with it);
3. there is a usable key.

Otherwise nothing is sent, and nothing is logged.

A failed notice is logged by its status only (such as `IndexNow answered 429`) and isn't retried.
Your sitemap still has the page, so nothing is lost.

## Requirements

- **EmDash 1.5 or later** (1.x).
- The plugin runs as a **trusted plugin** (EmDash's `plugins: []` list). It isn't a sandboxed
  plugin and isn't in the EmDash marketplace.
- **An IndexNow key**, served as a file on your site (below).

## Install

```sh
pnpm add @borislavhr/emdash-plugin-indexnow
# or: npm install @borislavhr/emdash-plugin-indexnow
```

Add it to EmDash's `plugins` in `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import emdash from 'emdash/astro';
import { indexNow } from '@borislavhr/emdash-plugin-indexnow';

export default defineConfig({
  integrations: [
    emdash({
      // …your database, storage and other settings
      plugins: [
        indexNow({
          siteUrl: 'https://example.org',
          // On only in the production build: set INDEXNOW=on in its build settings.
          enabled: process.env.INDEXNOW === 'on',
          key: 'c5e426466406d48a4cb9bf50a2033611',
          collections: {
            posts: {
              path: '/blog/{slug}',
              also: ['/blog', '/'],
              terms: { taxonomy: 'category', path: '/category/{slug}' },
            },
            pages: { path: '/{slug}', homeSlug: 'home' },
          },
        }),
      ],
    }),
  ],
});
```

The options are checked when the site builds, so a mistake (a path without `{slug}`, an `http://`
address) stops the build with a plain message instead of failing at the first notice.

## The key

IndexNow asks for a key, so search engines can tell your notices come from your site. **The key
isn't a secret:** search engines read it from a file on your site, so it's fine to have it in
`astro.config.mjs` and in your repository.

1. **Make a key.** Any 8 to 128 letters, digits or dashes will do; 32 hex characters is usual:

   ```sh
   openssl rand -hex 16
   # or: node -e "console.log(require('node:crypto').randomBytes(16).toString('hex'))"
   ```

2. **Give it to the plugin.** Either as the `key` option, or in the environment variable
   `INDEXNOW_KEY` (the name can be changed with `keyEnv`).

3. **Serve it** at the site's root, by default as `/<key>.txt`, containing just the key. The
   simplest way is a file in `public/`:

   ```sh
   echo -n c5e426466406d48a4cb9bf50a2033611 > public/c5e426466406d48a4cb9bf50a2033611.txt
   ```

   To serve it on the live address only, so a staging site can't vouch for its own addresses, use
   an Astro endpoint instead, and tell the plugin where it is with `keyLocation`:

   ```ts
   // src/pages/indexnow-key.txt.ts
   import type { APIRoute } from 'astro';

   export const prerender = false;

   const KEY = 'c5e426466406d48a4cb9bf50a2033611';

   export const GET: APIRoute = ({ url }) =>
     url.origin === 'https://example.org'
       ? new Response(KEY, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
       : new Response('Not found', { status: 404 });
   ```

   ```js
   indexNow({ siteUrl: 'https://example.org', key: KEY, keyLocation: '/indexnow-key.txt' });
   ```

The key file must be at the root. A key file in a folder only covers that folder's pages, so the
plugin refuses a `keyLocation` like `/keys/{key}.txt`.

To see notices arrive, add your site to **Bing Webmaster Tools** and open **IndexNow**.

## Options

| Option        | Default                                | What it does                                                                                                                                |
| ------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `siteUrl`     | required                               | The live site's address, such as `https://example.org`. Notices are sent only while the site runs at this address, and name only its pages. |
| `enabled`     | `false`                                | Whether notices are sent at all. Set it from the production build's environment.                                                            |
| `key`         | from `INDEXNOW_KEY`                    | The IndexNow key.                                                                                                                           |
| `keyEnv`      | `'INDEXNOW_KEY'`                       | The environment variable with the key when `key` isn't given.                                                                               |
| `keyLocation` | `'/{key}.txt'`                         | Where the site serves the key file. `{key}` is replaced with the key. Must be at the root.                                                  |
| `collections` | `{ posts: { path: '/posts/{slug}' } }` | The collections with public pages (below). Entries in other collections are never sent.                                                     |
| `endpoint`    | `'https://api.indexnow.org/indexnow'`  | Where notices go. The shared address passes them to every search engine that takes IndexNow; one engine's own address also works.           |

Each collection takes:

| Field      | Example                                              | What it does                                                                   |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `path`     | `'/blog/{slug}'`                                     | The address of an entry. `{slug}` is replaced with its slug.                   |
| `homeSlug` | `'home'`                                             | An entry with this slug is the front page, `/`.                                |
| `also`     | `['/blog', '/']`                                     | Pages that list these entries and change with them.                            |
| `terms`    | `{ taxonomy: 'category', path: '/category/{slug}' }` | A taxonomy whose term pages list the entry. Each of the entry's terms is sent. |

Slugs are put into the address with `encodeURIComponent`. An entry whose slug contains a slash,
`?`, `#`, `%` or white space, or is `.` or `..`, isn't sent.

## Privacy

- **Network:** only the endpoint's host, `api.indexnow.org` unless you change it.
- **What is sent:** your site's host, the key, where the key file is, and the full addresses of
  the pages that changed. Nothing else: no words from entries, no drafts, nothing about readers or
  editors.
- **Storage:** while a published entry is being deleted, its addresses, for a moment; removed
  once the notice is sent.
- **Logs:** statuses only.
- **Capabilities:** `content:read`, `network:request`, and `taxonomies:read` when a collection
  has `terms`.

Your privacy page can say: when a page is published or removed, its public address is sent to
IndexNow, which passes it to search engines; nothing about visitors is sent.

## Good to know

- The plugin's id is `indexnow`.
- When an editor changes a published entry's slug, only the new address is sent. Search engines
  find the old one's redirect or 404 on their next visit.
- An entry hidden from search engines in its SEO settings is still sent. Its own page has its
  `noindex`, and the pages that list it did change.

## Development

This package lives in the [emdash-plugins](https://github.com/BorislavHr/emdash-plugins)
repository.

```sh
pnpm install
pnpm --filter @borislavhr/emdash-plugin-indexnow test
pnpm --filter @borislavhr/emdash-plugin-indexnow build
```

## License

[MIT](./LICENSE)
