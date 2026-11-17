/**
 * `/boost` (decision 6, aliases `/rt`, `/reblog`): boost a post — share it with
 * your followers — or take the boost back when the post already carries one. A
 * leading label or the navigation selection names the post and a boost names
 * its original, as {@link runStatusToggle} describes; `b` in navigation mode
 * runs it on the selected post. `/unboost` always takes it back.
 */

import { toggleRun } from '../statusToggle';
import type { CommandDefinition } from '../types';

/** The `/boost` (alias `/rt`, `/reblog`) definition. */
export const command: CommandDefinition = {
  name: 'boost',
  aliases: ['rt', 'reblog'],
  usage: '/boost [label]',
  summary: 'Boost a post, or take the boost back',
  run: toggleRun('boost'),
  bindings: [{ mode: 'navigation', chord: 'b', args: '' }],
};
