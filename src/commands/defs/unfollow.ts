/**
 * `/unfollow [target]` (decision 6): take a follow back. The
 * target resolves like the other account commands' and the instance's
 * relationship answer is printed as `unfollowed @x`; what
 * {@link accountToggleRun} describes is the body.
 */

import { accountToggleRun } from '../accountToggle';
import type { CommandDefinition } from '../types';

/** The `/unfollow` definition. */
export const command: CommandDefinition = {
  name: 'unfollow',
  usage: '/unfollow [target]',
  summary: 'Take a follow back',
  run: accountToggleRun('unfollow', 'unfollowed'),
};
