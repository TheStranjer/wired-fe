/**
 * `/unblock [target]` (decision 6): take a block back. The
 * target resolves like the other account commands' and the instance's
 * relationship answer is printed as `unblocked @x`; what
 * {@link accountToggleRun} describes is the body.
 */

import { accountToggleRun } from '../accountToggle';
import type { CommandDefinition } from '../types';

/** The `/unblock` definition. */
export const command: CommandDefinition = {
  name: 'unblock',
  usage: '/unblock [target]',
  summary: 'Take a block back',
  run: accountToggleRun('unblock', 'unblocked'),
};
