// What astro.config imports: `discord(options)` describes the plugin to EmDash, which bundles the
// plugin itself from this package's `./plugin` entry at build time.
import type { PluginDescriptor } from 'emdash';

import { resolveOptions, type DiscordOptions } from './options.ts';
import { VERSION } from './version.ts';

export type { DiscordCollection, DiscordOptions } from './options.ts';
export type { DiscordText } from './text.ts';
export { DEFAULT_TEXT } from './text.ts';

export const PLUGIN_ID = 'discord';

export function discord(options: DiscordOptions = {}): PluginDescriptor<DiscordOptions> {
  // Checked here so a mistake in astro.config stops the build instead of the first post.
  resolveOptions(options);
  return {
    id: PLUGIN_ID,
    version: VERSION,
    format: 'native',
    entrypoint: '@borislavhr/emdash-plugin-discord/plugin',
    options,
  };
}
