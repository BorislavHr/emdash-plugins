// What astro.config imports: `indexNow(options)` describes the plugin to EmDash, which bundles
// the plugin itself from this package's `./plugin` entry at build time.
import type { PluginDescriptor } from 'emdash';

import { resolveOptions, type IndexNowOptions } from './options.ts';
import { VERSION } from './version.ts';

export type { IndexNowCollection, IndexNowOptions } from './options.ts';
export { isKey } from './options.ts';

export const PLUGIN_ID = 'indexnow';

export function indexNow(options: IndexNowOptions): PluginDescriptor<IndexNowOptions> {
  // Checked here so a mistake in astro.config stops the build instead of the first notice.
  resolveOptions(options);
  return {
    id: PLUGIN_ID,
    version: VERSION,
    format: 'native',
    entrypoint: '@borislavhr/emdash-plugin-indexnow/plugin',
    options,
  };
}
