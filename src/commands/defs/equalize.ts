/**
 * `/equalize` (decision 6): give every pane of the active desktop's split
 * tree an equal share of its space. Floats are not part of the tree and keep
 * their size. Arguments are ignored.
 */

import { OK, contextRun } from '../outcome';
import type { CommandDefinition } from '../types';

/** The `/equalize` definition. */
export const command: CommandDefinition = {
  name: 'equalize',
  usage: '/equalize',
  summary: 'Give every pane an equal share of the desktop',
  run: contextRun((context) => {
    context.dispatch({ type: 'layout', action: { type: 'equalize' } });
    return OK;
  }),
};
