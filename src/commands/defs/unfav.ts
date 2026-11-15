/**
 * `/unfav` (decision 6): take this account's favourite of a post back, whether
 * or not the scrollback knew about it. The same grammar as `/fav`, sent as the
 * undo: a leading label or the navigation selection names the post and a boost
 * names its original, as {@link runStatusToggle} describes. No default hotkey;
 * the typed command, `f` on a favourited post and this help entry reach it.
 */

import { runStatusToggle } from '../statusToggle';
import type { CommandDefinition } from '../types';

/** The `/unfav` definition. */
export const command: CommandDefinition = {
  name: 'unfav',
  aliases: [],
  usage: '/unfav [label]',
  summary: 'Take your favourite of a post back',
  run: async (args, context) => await runStatusToggle(args, context, 'unfav'),
};
