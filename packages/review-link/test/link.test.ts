import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { verifyPreviewToken } from 'emdash';

import { reviewLink } from '../src/index.ts';
import { isSecret, makeReviewLink, previewSecret, reviewPath } from '../src/link.ts';
import { resolveOptions } from '../src/options.ts';
import { DEFAULT_TEXT, format } from '../src/text.ts';
import { VERSION } from '../src/version.ts';

const secret = 'a'.repeat(64);

test('the address comes from the pattern and a slug that stays in its path', () => {
  assert.equal(reviewPath('/guides/{slug}', 'when-sleep-is-hard'), '/guides/when-sleep-is-hard');
  assert.equal(reviewPath('/{slug}/', 'about'), '/about/');
  assert.equal(reviewPath('/blog/{slug}', 'Café'), '/blog/Caf%C3%A9');
  assert.equal(reviewPath(undefined, 'about'), undefined);
  assert.equal(reviewPath('/guides/{slug}', ''), undefined);
  assert.equal(reviewPath('/guides/{slug}', null), undefined);
  assert.equal(reviewPath('/guides/{slug}', '..'), undefined);
  assert.equal(reviewPath('/guides/{slug}', '../_emdash/admin'), undefined);
  assert.equal(reviewPath('/guides/{slug}', 'a?b'), undefined);
  assert.equal(reviewPath('/guides/{slug}', 'a#b'), undefined);
  assert.equal(reviewPath('/guides/{slug}', 'a%2Fb'), undefined);
  assert.equal(reviewPath('/guides/{slug}', 'two words'), undefined);
});

test('a short or missing secret counts as not set up, and EmDash’s order of names is kept', () => {
  assert.equal(isSecret(undefined), false);
  assert.equal(isSecret('short'), false);
  assert.equal(isSecret('a'.repeat(31)), false);
  assert.equal(isSecret('a'.repeat(32)), true);
  assert.equal(previewSecret({}), undefined);
  assert.equal(previewSecret({ EMDASH_PREVIEW_SECRET: secret }), secret);
  assert.equal(previewSecret({ PREVIEW_SECRET: secret }), secret);
  assert.equal(previewSecret({ EMDASH_PREVIEW_SECRET: '  ', PREVIEW_SECRET: secret }), secret);
  // EmDash would sign with the short one, so the plugin must not sign with the other.
  assert.equal(
    previewSecret({ EMDASH_PREVIEW_SECRET: 'short', PREVIEW_SECRET: secret }),
    undefined,
  );
});

test('the link is an EmDash preview link for this entry that works for the chosen days', async () => {
  for (const days of [7, 14]) {
    const before = Date.now();
    const link = await makeReviewLink({
      collection: 'guides',
      id: '01M7AGNEQ77F07KG24WT861TEP',
      path: '/guides/when-sleep-is-hard',
      secret,
      base: 'https://example.org/',
      days,
    });
    const url = new URL(link.url);
    assert.equal(url.origin, 'https://example.org');
    assert.equal(url.pathname, '/guides/when-sleep-is-hard');

    const token = url.searchParams.get('_preview') ?? '';
    const checked = await verifyPreviewToken({ token, secret });
    assert.equal(checked.valid, true);
    if (!checked.valid) return;
    assert.equal(checked.payload.cid, 'guides:01M7AGNEQ77F07KG24WT861TEP');
    assert.equal((checked.payload.exp - checked.payload.iat) / 86400, days);
    const shown = link.expires.getTime() - before;
    assert.ok(Math.abs(shown - days * 86400 * 1000) < 5000, 'the date shown matches');

    // Another secret, or a changed token, is refused.
    assert.equal((await verifyPreviewToken({ token, secret: 'b'.repeat(64) })).valid, false);
    assert.equal((await verifyPreviewToken({ token: `${token}x`, secret })).valid, false);
  }
});

test('options get defaults, and a mistake is refused with a plain message', () => {
  const resolved = resolveOptions();
  assert.deepEqual(resolved.collections, { posts: '/posts/{slug}' });
  assert.equal(resolved.days, 7);
  assert.equal(resolved.text.panelTitle, DEFAULT_TEXT.panelTitle);
  assert.equal(resolveOptions({ text: { make: 'Link maken' } }).text.make, 'Link maken');

  assert.throws(() => resolveOptions({ collections: {} }), /at least one/);
  assert.throws(() => resolveOptions({ collections: { Posts: '/p/{slug}' } }), /collection name/);
  assert.throws(() => resolveOptions({ collections: { posts: 'posts/{slug}' } }), /single "\/"/);
  assert.throws(() => resolveOptions({ collections: { posts: '//evil/{slug}' } }), /single "\/"/);
  assert.throws(() => resolveOptions({ collections: { posts: '/posts/' } }), /\{slug\} once/);
  assert.throws(() => resolveOptions({ days: 0 }), /1 to 30/);
  assert.throws(() => resolveOptions({ days: 31 }), /1 to 30/);
  assert.throws(() => resolveOptions({ days: 2.5 }), /1 to 30/);
  assert.throws(() => resolveOptions({ timeZone: 'Not/AZone' }), RangeError);
});

test('the descriptor points EmDash at this package and checks the options at build time', () => {
  const descriptor = reviewLink({ collections: { guides: '/guides/{slug}' }, days: 14 });
  assert.equal(descriptor.id, 'review-link');
  assert.equal(descriptor.format, 'native');
  assert.equal(descriptor.entrypoint, '@borislavhr/emdash-plugin-review-link/plugin');
  assert.deepEqual(descriptor.options, { collections: { guides: '/guides/{slug}' }, days: 14 });
  // EmDash writes the options into the build as JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(descriptor.options)), descriptor.options);
  assert.throws(() => reviewLink({ days: 90 }), /1 to 30/);
});

test('the version matches package.json, and templates fill in their values', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
  assert.equal(
    format('Works for {days} days, {missing}', { days: 7 }),
    'Works for 7 days, {missing}',
  );
});
