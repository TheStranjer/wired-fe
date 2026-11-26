/**
 * `/local` (decision 6): open the local timeline — this instance's own posts —
 * as its own window (AGENTS.md "Windows, like IRC buffers"). From there the
 * window is reached like any other: `Alt+N`, `/win N`, a click on the status
 * line — and opening it again only activates the window that already shows it,
 * which is what the window reducer does with an `open` for a view it has. Plain
 * text typed into it posts to that account (src/features/local). Without an
 * account there is no session to ask for the timeline, so the command says what
 * to type instead. Text after the command is posted into that window as the
 * active account, the way typing it there would (WFE-279); `--in` places the
 * window.
 */

import { accountWindowOpen } from '../../state/accountWindow';
import { accountWindowRun } from '../openWindowRun';
import type { CommandDefinition } from '../types';

/** The `/local` definition. */
export const command: CommandDefinition = {
  name: 'local',
  usage: '/local [text] [--in <placement>]',
  summary: 'Open the local timeline',
  run: accountWindowRun((account, activeKey) => accountWindowOpen('local', account, activeKey), {
    postsText: true,
  }),
};
