/**
 * `/notifications` (decision 6, aliases `/n` and `/notifs`): open the active
 * account's notifications as their own window (AGENTS.md "Windows, like IRC
 * buffers"). From there the window is reached like any other — `/win N`,
 * `Alt+N`, a click on the status line — and opening it again only activates
 * the window that already shows it, which is what the window reducer does with
 * an `open` for a view it has. Nothing posts into it (src/features/
 * notifications). Without an account there is no notification list to open, so
 * the command says what to type instead; arguments are ignored, the active
 * account is the only subject.
 */

import { notificationsWindowOpen } from '../../state/notificationsWindow';
import { accountWindowRun } from '../openWindowRun';
import type { CommandDefinition } from '../types';

/** The `/notifications` definition. */
export const command: CommandDefinition = {
  name: 'notifications',
  aliases: ['n', 'notifs'],
  usage: '/notifications',
  summary: 'Open your notifications',
  run: accountWindowRun(notificationsWindowOpen),
};
