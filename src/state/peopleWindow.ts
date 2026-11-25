/**
 * The people window of another window (AGENTS.md "Windows, like IRC buffers",
 * decision 13): who is in a window is a window of its own, kind `people`,
 * owned by the same account as the window it watches and targeting that
 * window's id. Built here in the pure state layer so the `/people` command and
 * the view share it without importing each other (AGENTS.md "Layout").
 */

import { type WindowRef, type WindowState, windowId } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** The open variant of the window list's vocabulary, which this builds. */
type OpenAction = Extract<WindowsAction, { readonly type: 'open' }>;

/** The ref of the people window that watches {@link watched}. */
function peopleRef(watched: WindowState): WindowRef {
  return { kind: 'people', accountKey: watched.ref.accountKey, target: watched.id };
}

/** The id of the people window that watches {@link watched}. */
export function peopleWindowId(watched: WindowState): string {
  return windowId(peopleRef(watched));
}

/** The window-list transition that opens the people window of {@link watched}, titled `people:<title>`. */
export function peopleWindowOpen(watched: WindowState): OpenAction {
  return { type: 'open', ref: peopleRef(watched), title: `people:${watched.title}` };
}
