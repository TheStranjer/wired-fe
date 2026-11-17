/**
 * `/react` (decision 6): add an emoji reaction to a post, where the instance
 * supports them (WBE-178). The target and the emoji parse as
 * {@link reactionRun} describes: a leading label or the navigation selection
 * names the post, the one word after it is the emoji — `🔥` sent as typed,
 * `:blob:` sent as the shortcode `blob`. `Shift+e` prefills the line with the
 * selected post's label; type the emoji and Enter sends it.
 */

import { reactionRun } from '../reactions';
import type { CommandDefinition } from '../types';

/** The `/react` definition. */
export const command: CommandDefinition = {
  name: 'react',
  aliases: [],
  usage: '/react [label] <emoji>',
  summary: 'React to a post with an emoji',
  run: reactionRun('react'),
  bindings: [{ mode: 'navigation', chord: 'Shift+e', args: '{label}', prefill: true }],
};
