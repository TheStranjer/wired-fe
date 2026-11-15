/**
 * A window that shows one account's paged timeline (AGENTS.md "Windows, like
 * IRC buffers"): the window's own scrollback as ./BufferView draws it, kept
 * filled by ./useTimeline. Which timeline it is arrives as the caller's
 * {@link FetchPage}; the window itself knows only its id, its name and that
 * it pages.
 */

import type { JSX } from 'react';

import { BufferView } from './BufferView';
import { type FetchPage, useTimeline } from './useTimeline';

/** Props of {@link TimelineWindow}: which window, its name, its page source. */
type TimelineWindowProps = {
  readonly windowId: string;
  readonly label: string;
  readonly fetchPage: FetchPage;
};

/** The timeline window: it loads its pages and renders the buffer's lines. */
export function TimelineWindow(props: TimelineWindowProps): JSX.Element {
  const { fetchPage, label, windowId } = props;
  useTimeline(windowId, fetchPage);
  return <BufferView label={label} windowId={windowId} />;
}
