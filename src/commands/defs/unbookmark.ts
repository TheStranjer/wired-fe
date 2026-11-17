/**
 * `/unbookmark` (decision 6): take a post out of this account's bookmarks
 * again. The same grammar as `/bookmark`, sent as the undo: a leading label or
 * the navigation selection names the post and a boost names its original, as
 * {@link runStatusToggle} describes. No default hotkey; the typed command,
 * `Shift+b` on a bookmarked post and this help entry reach it.
 */

import { toggleRun } from '../statusToggle';
import type { CommandDefinition } from '../types';

/** The `/unbookmark` definition. */
export const command: CommandDefinition = {
  name: 'unbookmark',
  aliases: [],
  usage: '/unbookmark [label]',
  summary: 'Remove your bookmark of a post',
  run: toggleRun('unbookmark'),
};
