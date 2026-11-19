/**
 * `/unreact` (decision 6): take this account's emoji reaction back off a
 * post, where the instance supports them (WBE-178). The same grammar as
 * `/react`, sent as a DELETE: a leading label or the navigation selection
 * names the post, the one word after it is the emoji — `🔥` removed as
 * typed, `:blob:` as the shortcode `blob`. No default hotkey; the typed
 * command and this help entry reach it.
 */

import { reactionRun } from '../reactions';
import type { CommandDefinition } from '../types';

/** The `/unreact` definition. */
export const command: CommandDefinition = {
  name: 'unreact',
  usage: '/unreact [label] <emoji>',
  summary: 'Remove your emoji reaction from a post',
  run: reactionRun('unreact'),
};
