/**
 * `/follow [target]` (decision 6): follow an account as the
 * window's own. The target resolves like the other account commands' (a
 * handle looked up, a post label or the selection's author, a boost naming
 * its boosted author), and the relationship the instance answers is printed:
 * `following @x`, or `follow requested @x` while a locked account decides.
 * What {@link accountToggleRun} describes is the body; a refusal to follow
 * yourself comes back as its message. `Shift+F` in navigation mode follows
 * the author of the selected post, as immediate as the post toggles.
 */

import { accountToggleRun } from '../accountToggle';
import type { CommandDefinition } from '../types';

/** The `/follow` definition. */
export const command: CommandDefinition = {
  name: 'follow',
  usage: '/follow [target]',
  summary: 'Follow an account',
  run: accountToggleRun('follow', 'following'),
  bindings: [{ mode: 'navigation', chord: 'Shift+f', args: '' }],
};
