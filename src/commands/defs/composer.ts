/**
 * `/composer` (decision 13, WFE-198): open a fresh composer as a window of its
 * own, posting as the active account. Unlike the `/compose` overlay it stays: a
 * pane is persistent, takes what is typed at the command line while it is
 * focused, and has a "Post as" picker for any signed-in account. For now it
 * opens in the active window's place — it becomes the active window; where it
 * lands in the layout comes with placement. Arguments are ignored.
 */

import { composerWindowOpen } from '../../state/composerWindow';
import { activeAccount } from '../../state/selectors';
import { NOT_LOGGED_IN, OK, contextRun } from '../outcome';
import type { CommandDefinition } from '../types';

/** The `/composer` definition. */
export const command: CommandDefinition = {
  name: 'composer',
  usage: '/composer',
  summary: 'Open a composer window',
  run: contextRun((context) => {
    const account = activeAccount(context.state);
    if (account === null) {
      return NOT_LOGGED_IN;
    }
    context.dispatchWindows(composerWindowOpen(account, context.windows.windows));
    return OK;
  }),
};
