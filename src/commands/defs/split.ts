/**
 * `/split [view…]` (alias `/sp`; decisions 6, 12 and 13): split the focused
 * pane stacked (`column`) and focus the new pane. Everything else is
 * `/vsplit`'s: no argument shows the same window in the new pane, and a view
 * spec opens a view into it (`/split tag rust`).
 */

import { VIEW_USAGE, splitRun } from '../splitRun';
import type { CommandDefinition } from '../types';

/** The command's grammar: /help shows it, a bad argument echoes it. */
const USAGE = `/split ${VIEW_USAGE}`;

/** The `/split` (alias `/sp`) definition. */
export const command: CommandDefinition = {
  name: 'split',
  aliases: ['sp'],
  usage: USAGE,
  summary: 'Split the focused pane stacked',
  run: splitRun('column', USAGE),
};
