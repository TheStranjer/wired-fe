/**
 * `/unpin` (decision 6): take one of this account's own posts off the top of
 * its profile again. The same grammar as `/pin`, sent as the undo: a leading
 * label or the navigation selection names the post, as
 * {@link runStatusToggle} describes, and a post of anybody else refuses before
 * anything leaves. No default hotkey; the typed command, `Shift+p` on a pinned
 * post and this help entry reach it.
 */

import { toggleRun } from '../statusToggle';
import type { CommandDefinition } from '../types';

/** The `/unpin` definition. */
export const command: CommandDefinition = {
  name: 'unpin',
  usage: '/unpin [label]',
  summary: 'Unpin one of your own posts',
  run: toggleRun('unpin'),
};
