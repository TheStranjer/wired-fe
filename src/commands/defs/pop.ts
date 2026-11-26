/**
 * `/pop [label]` (decisions 6, 12 and 13, WFE-241, WFE-291): open a post's
 * thread window in a new float, focused. It is `/float thread [label]` under
 * another name, so the target resolves the way `/thread` does (a leading label
 * names a post of the active window's scrollback, otherwise the navigation
 * selection stands), the window is titled `thread/<label>`, and closing the
 * float leaves the thread window as a hidden buffer like any other float.
 * Two cases open nothing (./popThread): from inside a thread window the post
 * is already in that thread, so an info line says so and the selection stays;
 * and a thread window already shown in a pane or float of the active desktop
 * is focused (and raised, a float) instead of shown twice. Navigation-mode `p`
 * runs it on the selected post; a double-click on a post runs it on that post's
 * label.
 */

import { command as float } from './float';
import { popInPlace } from '../popThread';
import type { CommandDefinition } from '../types';

/** The `/pop` definition. */
export const command: CommandDefinition = {
  name: 'pop',
  usage: '/pop [label]',
  summary:
    "Pop a post's thread out into a floating window, or focus it where it is shown; inside that thread, do nothing (hotkey p, or double-click)",
  run: async (args, context) =>
    (await popInPlace(args, context)) ?? (await float.run(`thread ${args.trim()}`, context)),
  bindings: [{ mode: 'navigation', chord: 'p', args: '' }],
};
