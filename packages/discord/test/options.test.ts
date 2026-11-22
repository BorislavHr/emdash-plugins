import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { fileHref, safeHref } from '../src/files.ts';
import { discord } from '../src/index.ts';
import { resolveOptions } from '../src/options.ts';
import { DEFAULT_TEXT, format } from '../src/text.ts';
import { VERSION } from '../src/version.ts';

test('options get defaults', () => {
  const resolved = resolveOptions();
  assert.deepEqual(resolved.collections, { posts: { path: '/posts/{slug}', name: 'post' } });
  assert.equal(resolved.titleField, 'title');
  assert.equal(resolved.summaryField, 'excerpt');
  assert.equal(resolved.imageField, 'featured_image');
  assert.equal(resolved.taxonomy, null);
  assert.equal(resolved.colour, null);
  assert.equal(resolved.webhookEnv, 'DISCORD_WEBHOOK_URL');
  assert.equal(resolved.postsPerHour, 30);
  assert.equal(resolved.text.panelTitle, DEFAULT_TEXT.panelTitle);
});

test('options are taken as given, and a collection without a name uses its own', () => {
  const resolved = resolveOptions({
    collections: { guides: { path: '/guides/{slug}', name: 'guide' }, news: { path: '/n/{slug}' } },
    summaryField: 'summary',
    imageField: null,
    taxonomy: 'situation',
    termImages: { 'school-and-care': '/og/situation-school-and-care.jpg' },
    defaultImage: 'https://example.org/og.jpg',
    colour: '#2F6F5E',
    text: { newLabel: 'Nieuw: {kind}' },
  });
  assert.equal(resolved.collections.news?.name, 'news');
  assert.equal(resolved.summaryField, 'summary');
  assert.equal(resolved.imageField, null);
  assert.equal(resolved.colour, 0x2f6f5e);
  assert.equal(resolved.text.newLabel, 'Nieuw: {kind}');
  assert.equal(resolved.text.updateLabel, DEFAULT_TEXT.updateLabel);
});

test('a mistake in the options is refused with a plain message', () => {
  const bad: [Parameters<typeof resolveOptions>[0], RegExp][] = [
    [{ collections: {} }, /at least one/],
    [{ collections: { Posts: { path: '/p/{slug}' } } }, /collection name/],
    [{ collections: { posts: { path: 'posts/{slug}' } } }, /single "\/"/],
    [{ collections: { posts: { path: '//evil/{slug}' } } }, /single "\/"/],
    [{ collections: { posts: { path: '/posts/' } } }, /\{slug\} once/],
    [{ titleField: 'Title!' }, /field name/],
    [{ taxonomy: 'Bad Name' }, /taxonomy name/],
    [{ termImages: { a: 'javascript:alert(1)' } }, /site path/],
    [{ defaultImage: 'http://example.org/a.jpg' }, /site path/],
    [{ defaultImage: '//example.org/a.jpg' }, /site path/],
    [{ colour: 'green' }, /#rrggbb/],
    [{ webhookEnv: 'discord-url' }, /environment variable/],
    [{ postsPerHour: 0 }, /1 to 100/],
    [{ postsPerHour: 1000 }, /1 to 100/],
  ];
  for (const [options, message] of bad) assert.throws(() => resolveOptions(options), message);
});

test('the descriptor points EmDash at this package and checks the options at build time', () => {
  const options = { collections: { guides: { path: '/guides/{slug}', name: 'guide' } } };
  const descriptor = discord(options);
  assert.equal(descriptor.id, 'discord');
  assert.equal(descriptor.format, 'native');
  assert.equal(descriptor.entrypoint, '@borislavhr/emdash-plugin-discord/plugin');
  // EmDash writes the options into the build as JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(descriptor.options)), options);
  assert.throws(() => discord({ colour: 'red' }), /#rrggbb/);
});

test('a picture comes from the image value, or from the media library by its storage key', () => {
  assert.equal(fileHref({ url: 'https://cdn.example.org/a.jpg' }), 'https://cdn.example.org/a.jpg');
  assert.equal(fileHref({ src: '/media/a.jpg' }), '/media/a.jpg');
  assert.equal(
    fileHref({ provider: 'local', meta: { storageKey: '01ABC/photo one.jpg' } }),
    '/_emdash/api/media/file/01ABC%2Fphoto%20one.jpg',
  );
  assert.equal(fileHref({ url: 'javascript:alert(1)' }), undefined);
  assert.equal(fileHref({ provider: 's3', meta: { storageKey: 'x' } }), undefined);
  assert.equal(fileHref(null), undefined);
  assert.equal(safeHref('/\t/evil.example'), undefined);
  assert.equal(safeHref('/\\evil.example'), undefined);
  assert.equal(safeHref('HTTPS://example.org/a'), 'https://example.org/a');
});

test('the version matches package.json, and templates fill in their values', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
  assert.equal(format(DEFAULT_TEXT.newLabel, { kind: 'guide' }), 'New guide');
});
