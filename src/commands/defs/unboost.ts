/**
 * `/unboost` (decision 6): take this account's boost of a post back. The same
 * grammar as `/boost`, sent as the undo: a leading label or the navigation
 * selection names the post and a boost names its original, as
 * {@link runStatusToggle} describes. No default hotkey; the typed command, `b`
 * on a boosted post and this help entry reach it.
 */

import { toggleRun } from '../statusToggle';
import type { CommandDefinition } from '../types';

/** The `/unboost` definition. */
export const command: CommandDefinition = {
  name: 'unboost',
  usage: '/unboost [label]',
  summary: 'Take your boost of a post back',
  run: toggleRun('unboost'),
};
