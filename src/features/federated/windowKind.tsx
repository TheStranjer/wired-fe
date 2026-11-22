/**
 * The `federated` window kind (AGENTS.md "Windows, like IRC buffers"): the
 * public timeline as it federates, the posts of everyone the instance talks to,
 * its pages pulled by the shared loader and its lines drawn by the shared
 * scrollback (src/views/TimelineWindow). The label is the accessible name of
 * that log region. Plain text typed while this window is active is a post: it
 * goes out as the window's own account and lands at the bottom of its own
 * scrollback, which is what src/state/postStatus does for every postable window.
 */

import type { JSX } from 'react';

import { publicTimeline } from '../../api/endpoints/timelines';
import { type WindowKindDefinition, postToWindow } from '../../state/windowKind';
import { TimelineWindow } from '../../views/TimelineWindow';
import type { FetchPage } from '../../views/useTimeline';

/** Every post the public timeline carries: `local` left off every request. */
const fetchFederatedPage: FetchPage = async (session, page, signal) =>
  await publicTimeline(session, { local: false, page }, signal);

/** The federated window: its buffer's lines, kept full by the federated timeline. */
function FederatedWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  return <TimelineWindow fetchPage={fetchFederatedPage} label="federated" windowId={windowId} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'federated',
  topic: () => 'federated timeline',
  Component: FederatedWindow,
  onPost: postToWindow,
};
