import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_ATTEMPTS,
  canPost,
  canPostUpdate,
  isNew,
  isWebhook,
  message,
  pagePath,
  panelState,
  shorten,
  webhookFrom,
} from '../src/message.ts';

const real = `https://discord.com/api/webhooks/123456789012345678/${'a'.repeat(68)}`;

test('only an entry first published within the last day is new', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  assert.equal(isNew('2026-11-16T11:59:00Z', now), true);
  assert.equal(isNew('2026-11-15T12:30:00Z', now), true);
  // Published long ago (a republish, an import, a copy from another site): not new.
  assert.equal(isNew('2026-11-15T11:00:00Z', now), false);
  assert.equal(isNew('2025-03-01T09:00:00Z', now), false);
  assert.equal(isNew(null, now), false);
  assert.equal(isNew('not a date', now), false);
  // Clocks a minute apart are still "just now"; a date far ahead is not.
  assert.equal(isNew('2026-11-16T12:01:00Z', now), true);
  assert.equal(isNew('2026-11-17T12:00:00Z', now), false);
});

test('only a Discord webhook address counts as set up', () => {
  assert.equal(isWebhook(real), true);
  assert.equal(isWebhook(real.replace('https:', 'http:')), false);
  assert.equal(isWebhook(real.replace('discord.com', 'discord.com.example.org')), false);
  assert.equal(isWebhook(`${real}?thread_id=1`), false);
  assert.equal(isWebhook(''), false);
  assert.equal(isWebhook(undefined), false);
  assert.equal(webhookFrom('DISCORD_WEBHOOK_URL', { DISCORD_WEBHOOK_URL: ` ${real} ` }), real);
  assert.equal(webhookFrom('DISCORD_WEBHOOK_URL', { OTHER: real }), undefined);
  assert.equal(
    webhookFrom('DISCORD_WEBHOOK_URL', { DISCORD_WEBHOOK_URL: 'https://x.eu' }),
    undefined,
  );
});

test('page addresses use the collection pattern and a slug that stays in its path', () => {
  assert.equal(pagePath('/guides/{slug}', 'sleep'), '/guides/sleep');
  assert.equal(pagePath('/{slug}/', 'about'), '/about/');
  assert.equal(pagePath('/blog/{slug}', 'Café'), '/blog/Caf%C3%A9');
  assert.equal(pagePath('/guides/{slug}', '../admin'), undefined);
  assert.equal(pagePath('/guides/{slug}', '..'), undefined);
  assert.equal(pagePath('/guides/{slug}', 'a?b'), undefined);
  assert.equal(pagePath('/guides/{slug}', null), undefined);
  assert.equal(pagePath(undefined, 'sleep'), undefined);
});

test('long text is cut at a word', () => {
  assert.equal(shorten('short', 10), 'short');
  assert.equal(shorten('one two three four', 12), 'one two…');
  assert.equal(shorten('  spaced \n out  ', 20), 'spaced out');
});

test('a post has the label, the title as a link, the summary, the term and the picture', () => {
  const body = message({
    label: 'New guide',
    title: 'Sleep when your child does not',
    summary: 'Small things that helped.',
    href: 'https://example.org/guides/sleep',
    picture: 'https://example.org/og/everyday-life.jpg',
    term: 'Everyday life',
    colour: 0x2f6f5e,
  });
  const [embed] = body.embeds;
  assert.equal(embed?.author.name, 'New guide');
  assert.equal(embed?.title, 'Sleep when your child does not');
  assert.equal(embed?.url, 'https://example.org/guides/sleep');
  assert.equal(embed?.description, 'Small things that helped.');
  assert.deepEqual(embed?.footer, { text: 'Everyday life' });
  assert.deepEqual(embed?.image, { url: 'https://example.org/og/everyday-life.jpg' });
  assert.equal(embed?.color, 0x2f6f5e);
});

test('a post can never mention anyone, and leaves out what it lacks', () => {
  const body = message({
    label: 'Updated story',
    title: '@everyone hello',
    href: 'https://x.eu/s/a',
  });
  assert.deepEqual(body.allowed_mentions, { parse: [] });
  const [embed] = body.embeds;
  assert.equal(embed?.author.name, 'Updated story');
  for (const missing of ['description', 'image', 'footer', 'color']) {
    assert.equal(missing in (embed ?? {}), false, missing);
  }
});

test('the panel says what happened, and the switch and the secret come first', () => {
  const posted = { kind: 'new', at: '2026-11-16T10:00:00Z', status: 'posted' } as const;
  const failed = {
    kind: 'new',
    at: '2026-11-16T10:00:00Z',
    status: 'failed',
    attempts: 1,
  } as const;
  const now = new Date('2026-11-16T12:00:00Z');
  const base = { connected: true, on: true, published: true, record: null, now };
  assert.deepEqual(panelState({ ...base, connected: false }), { kind: 'notConnected' });
  assert.deepEqual(panelState({ ...base, on: false, record: posted }), { kind: 'off' });
  assert.deepEqual(panelState({ ...base, published: false }), { kind: 'waiting' });
  assert.deepEqual(panelState(base), { kind: 'notPosted' });
  assert.deepEqual(panelState({ ...base, record: posted }), {
    kind: 'posted',
    at: posted.at,
    update: false,
    canUpdate: false,
  });
  assert.deepEqual(panelState({ ...base, record: failed }), { kind: 'failed', gaveUp: false });
  assert.deepEqual(panelState({ ...base, record: { ...failed, attempts: MAX_ATTEMPTS } }), {
    kind: 'failed',
    gaveUp: true,
  });
});

test('"Don\'t post this one" keeps an entry out until undone, but never hides a post that went out', () => {
  const posted = { kind: 'new', at: '2026-11-16T10:00:00Z', status: 'posted' } as const;
  const failed = { ...posted, status: 'failed', attempts: 1 } as const;
  const now = new Date('2026-11-16T12:00:00Z');
  const base = { connected: true, on: true, published: true, record: null, now, skipped: true };
  assert.deepEqual(panelState(base), { kind: 'skipped' });
  assert.deepEqual(panelState({ ...base, published: false }), { kind: 'skipped' });
  assert.deepEqual(panelState({ ...base, on: false }), { kind: 'skipped' });
  assert.deepEqual(panelState({ ...base, record: failed }), { kind: 'skipped' });
  assert.equal(panelState({ ...base, record: posted }).kind, 'posted');
  assert.deepEqual(panelState({ ...base, connected: false }), { kind: 'notConnected' });
  assert.deepEqual(panelState({ ...base, skipped: false }), { kind: 'notPosted' });
  assert.equal(canPost(null, true), false);
  assert.equal(canPost(failed, true), false);
  assert.equal(canPost(null, false), true);
});

test('a post that went out is never sent again as new, and an update waits a day', () => {
  const posted = { kind: 'new', at: '2026-11-16T10:00:00Z', status: 'posted' } as const;
  const failed = { ...posted, status: 'failed', attempts: 2 } as const;
  assert.equal(canPost(null), true);
  assert.equal(canPost(failed), true);
  assert.equal(canPost(posted), false);
  assert.equal(canPostUpdate(null, new Date('2026-11-20T00:00:00Z')), false);
  assert.equal(canPostUpdate(failed, new Date('2026-11-20T00:00:00Z')), false);
  assert.equal(canPostUpdate(posted, new Date('2026-11-16T22:00:00Z')), false);
  assert.equal(canPostUpdate(posted, new Date('2026-11-17T10:00:00Z')), true);
});
