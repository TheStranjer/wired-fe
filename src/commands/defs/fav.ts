/**
 * `/fav` (decision 6, aliases `/f`, `/like`): favourite a post, or take the
 * favourite back when the post already carries one. A leading label or the
 * navigation selection names the post and a boost names its original, as
 * {@link runStatusToggle} describes; `f` in navigation mode runs it on the
 * selected post. `/unfav` always takes it back.
 */

import { runStatusToggle } from '../statusToggle';
import type { CommandDefinition } from '../types';

/** The `/fav` (alias `/f`, `/like`) definition. */
export const command: CommandDefinition = {
  name: 'fav',
  aliases: ['f', 'like'],
  usage: '/fav [label]',
  summary: 'Favourite a post, or take the favourite back',
  run: async (args, context) => await runStatusToggle(args, context, 'fav'),
  bindings: [{ mode: 'navigation', chord: 'f', args: '' }],
};
