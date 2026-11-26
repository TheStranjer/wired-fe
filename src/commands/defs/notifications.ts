/**
 * `/notifications` (decision 6, aliases `/n` and `/notifs`): open the active
 * account's notifications as their own window (AGENTS.md "Windows, like IRC
 * buffers"). From there the window is reached like any other — `/win N`,
 * `Alt+N`, a click on the status line — and opening it again only activates
 * the window that already shows it, which is what the window reducer does with
 * an `open` for a view it has. Text after the command is posted as the active
 * account, as typing it in the window would (WFE-283): the list is not a
 * timeline, so the post is only confirmed, not added to it
 * (src/state/postAsWindowAccount). `--in` places the window. Without an
 * account there is no notification list to open, so the command says what to
 * type instead.
 */

import { notificationsWindowOpen } from '../../state/notificationsWindow';
import { postAsAccount } from '../../state/postAsWindowAccount';
import { accountWindowRun } from '../openWindowRun';
import type { CommandDefinition } from '../types';

/** The `/notifications` definition. */
export const command: CommandDefinition = {
  name: 'notifications',
  aliases: ['n', 'notifs'],
  usage: '/notifications [text] [--in <placement>]',
  summary: 'Open your notifications',
  run: accountWindowRun(notificationsWindowOpen, { postsText: postAsAccount }),
};
