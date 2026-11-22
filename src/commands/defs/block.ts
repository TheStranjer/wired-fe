/**
 * `/block [target]` (decision 6): block an account as the
 * window's own. The target resolves like the other account commands' and the
 * instance's relationship answer is printed as `blocked @x`; what
 * {@link accountToggleRun} describes is the body, WBE-179 federating it on
 * Wired. `Shift+X` in navigation mode prefills the line — a click away from
 * sending, because a block is not a toggle to knock out by accident.
 */

import { accountToggleRun } from '../accountToggle';
import type { CommandDefinition } from '../types';

/** The `/block` definition. */
export const command: CommandDefinition = {
  name: 'block',
  usage: '/block [target]',
  summary: 'Block an account',
  run: accountToggleRun('block', 'blocked'),
  bindings: [{ mode: 'navigation', chord: 'Shift+x', args: '{label}', prefill: true }],
};
