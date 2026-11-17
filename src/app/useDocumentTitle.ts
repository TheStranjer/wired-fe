/**
 * The browser tab's title (WFE-134, AGENTS.md "Windows, like IRC buffers"): a
 * reader who has tabbed away still needs to see that something arrived, so the
 * title carries what the status line's window list carries — the total unread
 * count of every window in parentheses, and the `*` that marks a highlight in
 * front of it, before the app name: `* (3) WIRED`. The tally comes from
 * src/windows/unread, the name from the build configuration (decision 3), and
 * the title the document shipped with is put back when the shell unmounts.
 */

import { useEffect } from 'react';

import { buildConfig } from '../config/config';
import type { WindowsState } from '../windows/model';
import { totalUnread } from '../windows/unread';

/** The marker the status line gives a highlighted window, in the title too. */
const HIGHLIGHT_MARKER = '* ';

/** The unread tally as the title shows it; nothing while every window is read. */
function unreadTally(windows: WindowsState): string {
  const total = totalUnread(windows);
  return total === 0 ? '' : `(${String(total)}) `;
}

/**
 * The tab title for {@link windows} under {@link appName}: the highlight
 * marker, then the total unread tally, then the name — so `* (3) Wired`,
 * `(3) Wired` or plain `Wired`.
 */
export function documentTitle(windows: WindowsState, appName: string): string {
  const highlighted = windows.windows.some((win) => win.highlight);
  return `${highlighted ? HIGHLIGHT_MARKER : ''}${unreadTally(windows)}${appName}`;
}

/**
 * Keep `document.title` at {@link documentTitle} for {@link windows} for as
 * long as the shell is mounted, and hand back the title the document came with
 * once it unmounts. The original is captured before the first write, so a
 * deployment that renamed the page keeps its own title on the way out. The
 * write follows the title's *text*, not the window list's identity: opening or
 * renumbering a window is a new list that says the same thing about unread
 * lines, and renaming the document is a change every reader of the page, the
 * assistive ones included, has to hear about.
 */
export function useDocumentTitle(windows: WindowsState): void {
  const title = documentTitle(windows, buildConfig.appName);
  useEffect(() => {
    const original = document.title;
    return () => {
      document.title = original;
    };
  }, []);

  useEffect(() => {
    document.title = title;
  }, [title]);
}
