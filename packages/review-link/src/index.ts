// What astro.config imports: `reviewLink(options)` describes the plugin to EmDash, which bundles
// the plugin itself from this package's `./plugin` entry at build time.
import type { PluginDescriptor } from 'emdash';

import { resolveOptions, type ReviewLinkOptions } from './options.ts';
import { VERSION } from './version.ts';

export type { ReviewLinkOptions } from './options.ts';
export type { ReviewLinkText } from './text.ts';
export { DEFAULT_TEXT } from './text.ts';

export const PLUGIN_ID = 'review-link';

export function reviewLink(options: ReviewLinkOptions = {}): PluginDescriptor<ReviewLinkOptions> {
  // Checked here so a mistake in astro.config stops the build instead of the editor panel.
  resolveOptions(options);
  return {
    id: PLUGIN_ID,
    version: VERSION,
    format: 'native',
    entrypoint: '@borislavhr/emdash-plugin-review-link/plugin',
    options,
  };
}
