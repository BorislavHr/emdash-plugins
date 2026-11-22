# EmDash plugins

Three trusted plugins for [EmDash CMS](https://github.com/emdash-cms/emdash), taken from a live
site that runs them.

| Package                                                           | What it does                                                                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@borislavhr/emdash-plugin-review-link`](./packages/review-link) | A private link to an entry's draft that works for days instead of an hour, for reviewers without an admin account.                            |
| [`@borislavhr/emdash-plugin-discord`](./packages/discord)         | A short Discord post when an entry is published for the first time, with a switch, retries, an hourly limit and an editor panel.              |
| [`@borislavhr/emdash-plugin-indexnow`](./packages/indexnow)       | Tells search engines through IndexNow when a page is published, unpublished or deleted, with the pages that list it, from the live site only. |

Each package's README covers installing it, its options and what it does with data.

## What they have in common

- **Trusted plugins.** They go in EmDash's `plugins: []` list in `astro.config.mjs` and run in
  your site's own process. They aren't sandboxed plugins, so they aren't in the EmDash
  marketplace.
- **Careful with data.** None of them sends drafts or anything about readers or editors anywhere.
  The review link makes no network requests at all; the Discord plugin talks only to
  `discord.com`, and the IndexNow plugin only to `api.indexnow.org`. Secrets come from the
  environment, never from code or settings stored in the database.
- **Plain options.** Everything is set in `astro.config.mjs` and checked when the site builds, so a
  mistake stops the build with a plain message.
- **Any language.** Every word in the editor panels can be replaced through a `text` option.
- **Quiet off the live site.** Nothing is posted or sent from a site that isn't set up for it:
  Discord needs its webhook and its switch, and IndexNow sends only from the live address.
- **EmDash 1.5 or later** (1.x), on Cloudflare Workers or Node.

## Development

Node 22.18 or later, and pnpm (`corepack enable` gives the version in `package.json`).

```sh
pnpm install
pnpm test        # node --test, on the TypeScript source
pnpm typecheck
pnpm build       # dist/ in each package
pnpm check       # formatting, types, tests and build: what CI runs
```

Each package is built with `tsc` to plain JavaScript and type declarations in `dist/`. EmDash
loads the plugin from the package's `./plugin` entry when the site builds.

## Reporting a problem

Open an issue. For a security problem, see [SECURITY.md](./SECURITY.md) instead.

## License

[MIT](./LICENSE)
