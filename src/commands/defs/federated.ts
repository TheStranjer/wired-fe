/**
 * `/federated` (decision 6, alias `/fed`): open the federated timeline — what
 * the instance talks to the rest of the fediverse about — as its own window
 * (AGENTS.md "Windows, like IRC buffers"). From there the window is reached like
 * any other: `Alt+N`, `/win N`, a click on the status line — and opening it
 * again only activates the window that already shows it, which is what the
 * window reducer does with an `open` for a view it has. Plain text typed into it
 * posts to that account (src/features/federated). Without an account there is no
 * session to ask for the timeline, so the command says what to type instead;
 * arguments are ignored, the active account is the only subject.
 */

import { accountWindowOpen } from '../../state/accountWindow';
import { accountWindowRun } from '../openWindowRun';
import type { CommandDefinition } from '../types';

/** The `/federated` definition. */
export const command: CommandDefinition = {
  name: 'federated',
  aliases: ['fed'],
  usage: '/federated',
  summary: 'Open the federated timeline',
  run: accountWindowRun((account, activeKey) => accountWindowOpen('federated', account, activeKey)),
};
