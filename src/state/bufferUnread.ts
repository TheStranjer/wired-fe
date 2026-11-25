/**
 * What a window that nobody is looking at has missed (AGENTS.md "Windows, like
 * IRC buffers", status line `2:home(3)*`). When a page of statuses or
 * notifications joins a scrollback, the lines that actually arrived are counted
 * for the window's unread tally, and the window is highlighted when one of them
 * speaks to its own account: it names that account in a mention, is aimed at it
 * alone, or announces that it was mentioned. Pure: the mark is the window list's
 * own `markUnread` action (src/windows/unread), and a window that is on screen
 * has nothing to count — activation is what acknowledges it.
 */

import type { AppState } from './appState';
import type { Buffer, LineData } from './buffer';
import { statusOfLine } from './bufferSelection';
import { isVisible } from './layoutSync';
import { accountByKey } from './selectors';
import type { WindowsState } from '../windows/model';
import { windowsReducer } from '../windows/reducer';

/** The lines that joined a buffer: those {@link after} has and {@link before} does not. */
export function addedLines(before: Buffer, after: Buffer): readonly LineData[] {
  const seen = new Set(before.lines.map((line) => line.key));
  return after.lines.filter((line) => !seen.has(line.key));
}

/**
 * The windows with {@link added} counted against the window that took them. The
 * very same windows state when nothing arrived: the count is what the window's
 * status line shows, so only lines that really joined are counted.
 */
export function markArrivals(
  state: AppState,
  windowId: string,
  added: readonly LineData[],
): WindowsState {
  if (added.length === 0 || isVisible(state.layout, windowId)) {
    return state.windows;
  }
  const account = windowAccountId(state, windowId);
  return windowsReducer(state.windows, {
    type: 'markUnread',
    id: windowId,
    count: added.length,
    highlight: added.some((line) => isHighlight(line, account)),
  });
}

/** The id the window's own account has on its instance; null for the status window or a signed-out owner. */
function windowAccountId(state: AppState, windowId: string): string | null {
  const win = state.windows.windows.find((candidate) => candidate.id === windowId);
  return accountByKey(state, win?.ref.accountKey ?? null)?.accountId ?? null;
}

/** Whether an arriving line speaks to the window's own account. */
function isHighlight(line: LineData, accountId: string | null): boolean {
  const status = statusOfLine(line);
  const aimed =
    status !== null &&
    (status.visibility === 'direct' ||
      (accountId !== null && status.mentions.some((mention) => mention.id === accountId)));
  return aimed || (line.kind === 'notification' && line.notification.kind === 'mention');
}
