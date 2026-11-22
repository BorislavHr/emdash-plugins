import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { indexNow } from '../src/index.ts';
import { fill, isLiveSite, keyFrom, noticeBody, pathsFor } from '../src/notify.ts';
import { resolveOptions } from '../src/options.ts';
import { VERSION } from '../src/version.ts';

const key = 'c5e426466406d48a4cb9bf50a2033611';
const options = resolveOptions({
  siteUrl: 'https://example.org',
  key,
  collections: {
    guides: {
      path: '/guides/{slug}',
      also: ['/resources'],
      terms: { taxonomy: 'situation', path: '/resources/{slug}' },
    },
    pages: { path: '/{slug}', homeSlug: 'home' },
    newsletter_issues: { path: '/newsletter/archive/{slug}', also: ['/newsletter/archive'] },
  },
});

test('an entry touches its page, the pages in "also" and its term pages', () => {
  assert.deepEqual(
    pathsFor({ collection: options.collections.guides, slug: 'sleep', terms: ['everyday-life'] }),
    ['/guides/sleep', '/resources', '/resources/everyday-life'],
  );
  assert.deepEqual(
    pathsFor({ collection: options.collections.newsletter_issues, slug: 'autumn' }),
    ['/newsletter/archive/autumn', '/newsletter/archive'],
  );
});

test('the home slug is the front page, and other pages touch only themselves', () => {
  assert.deepEqual(pathsFor({ collection: options.collections.pages, slug: 'about' }), ['/about']);
  assert.deepEqual(pathsFor({ collection: options.collections.pages, slug: 'home' }), ['/']);
});

test('other collections, and entries without a safe address, touch nothing', () => {
  assert.deepEqual(pathsFor({ collection: undefined, slug: 'ot' }), []);
  assert.deepEqual(pathsFor({ collection: options.collections.guides, slug: null }), []);
  assert.deepEqual(pathsFor({ collection: options.collections.guides, slug: '../admin' }), []);
  // A term with an unsafe slug is left out; the rest still goes.
  assert.deepEqual(
    pathsFor({ collection: options.collections.guides, slug: 'sleep', terms: ['a/b'] }),
    ['/guides/sleep', '/resources'],
  );
  assert.equal(fill('/blog/{slug}', 'Café'), '/blog/Caf%C3%A9');
});

test('the notice names the host, the key, where the key lives and each address once', () => {
  assert.deepEqual(
    noticeBody(options.site, key, '/{key}.txt', ['/guides/sleep', '/resources', '/resources']),
    {
      host: 'example.org',
      key,
      keyLocation: `https://example.org/${key}.txt`,
      urlList: ['https://example.org/guides/sleep', 'https://example.org/resources'],
    },
  );
  assert.equal(
    noticeBody(options.site, key, '/indexnow-key.txt', ['/']).keyLocation,
    'https://example.org/indexnow-key.txt',
  );
});

test('notices go only from the live address, with a usable key', () => {
  assert.equal(isLiveSite('https://example.org/', options.site), true);
  assert.equal(isLiveSite('https://staging.example.org/', options.site), false);
  assert.equal(isLiveSite('http://example.org/', options.site), false);
  assert.equal(isLiveSite('/', options.site), false);
  assert.equal(keyFrom(key, 'INDEXNOW_KEY', {}), key);
  assert.equal(keyFrom(null, 'INDEXNOW_KEY', { INDEXNOW_KEY: ` ${key} ` }), key);
  assert.equal(keyFrom(null, 'INDEXNOW_KEY', { INDEXNOW_KEY: 'short' }), undefined);
  assert.equal(keyFrom(null, 'INDEXNOW_KEY', {}), undefined);
});

test('options get defaults, and a mistake is refused with a plain message', () => {
  const resolved = resolveOptions({ siteUrl: 'https://example.org/' });
  assert.equal(resolved.enabled, false, 'off unless switched on');
  assert.equal(resolved.keyLocation, '/{key}.txt');
  assert.equal(resolved.endpoint.host, 'api.indexnow.org');
  assert.deepEqual(Object.keys(resolved.collections), ['posts']);

  const bad: [unknown, RegExp][] = [
    [undefined, /siteUrl/],
    [{ siteUrl: 'http://example.org' }, /https/],
    [{ siteUrl: 'https://example.org/blog' }, /address only/],
    [{ siteUrl: 'https://example.org', key: 'short' }, /8 to 128/],
    [{ siteUrl: 'https://example.org', key: 'has spaces in it' }, /8 to 128/],
    [{ siteUrl: 'https://example.org', keyEnv: 'lower' }, /environment variable/],
    [{ siteUrl: 'https://example.org', keyLocation: '/keys/{key}.txt' }, /at the root/],
    [{ siteUrl: 'https://example.org', keyLocation: '//evil/{key}.txt' }, /single "\/"/],
    [{ siteUrl: 'https://example.org', collections: {} }, /at least one/],
    [{ siteUrl: 'https://example.org', collections: { posts: { path: '/p/' } } }, /\{slug\} once/],
    [
      {
        siteUrl: 'https://example.org',
        collections: { posts: { path: '/p/{slug}', also: ['blog'] } },
      },
      /single "\/"/,
    ],
    [{ siteUrl: 'https://example.org', endpoint: 'http://api.indexnow.org/indexnow' }, /https/],
  ];
  for (const [given, message] of bad) {
    assert.throws(() => resolveOptions(given as never), message);
  }
});

test('the descriptor points EmDash at this package and checks the options at build time', () => {
  const given = { siteUrl: 'https://example.org', enabled: true, key };
  const descriptor = indexNow(given);
  assert.equal(descriptor.id, 'indexnow');
  assert.equal(descriptor.format, 'native');
  assert.equal(descriptor.entrypoint, '@borislavhr/emdash-plugin-indexnow/plugin');
  // EmDash writes the options into the build as JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(descriptor.options)), given);
  assert.throws(() => indexNow({ siteUrl: 'example.org' }), /https/);
});

test('the version matches package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
});
