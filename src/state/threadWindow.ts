/**
 * Opening a post's thread window (AGENTS.md "Windows, like IRC buffers"): the
 * one transition `/thread`, `/open` and a notification excerpt click all ask
 * for, built here in the pure state layer so commands and views share it
 * without importing each other (AGENTS.md "Layout"). The window's target is the
 * status id; opening the same post twice finds the window that already shows it.
 */

import type { WindowsAction } from '../windows/reducer';

/** The open variant of the window list's vocabulary, which this builds. */
type OpenAction = Extract<WindowsAction, { readonly type: 'open' }>;

/**
 * The window-list transition that opens the thread window of the status
 * {@link statusId}, owned by the window-list state {@link accountKey} names and
 * titled `thread/<label>`.
 */
export function threadWindowOpen(
  statusId: string,
  accountKey: string | null,
  label: string,
): OpenAction {
  return {
    type: 'open',
    ref: { kind: 'thread', accountKey, target: statusId },
    title: `thread/${label}`,
  };
}
