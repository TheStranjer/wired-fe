/**
 * `/home` (decision 6): open the active account's home timeline as its own
 * window (AGENTS.md "Windows, like IRC buffers"). From there the window is
 * reached like any other — `Alt+N`, `/win N`, a click on the status line — and
 * opening it again only activates the window that already shows it, which is
 * what the window reducer does with an `open` for a view it has. Plain text
 * typed into it posts to that account (src/features/home). Without an account
 * there is no timeline to open, so the command says what to type instead.
 * Text after the command is posted into that window as the active account,
 * the way typing it there would (WFE-279); `--in` places the window.
 */

import { homeWindowOpen } from '../../state/homeWindow';
import { postStatus } from '../../state/postStatus';
import { accountWindowRun } from '../openWindowRun';
import type { CommandDefinition } from '../types';

/** The `/home` definition. */
export const command: CommandDefinition = {
  name: 'home',
  usage: '/home [text] [--in <placement>]',
  summary: 'Open your home timeline',
  run: accountWindowRun(homeWindowOpen, { postsText: postStatus }),
};
