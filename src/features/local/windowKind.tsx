/**
 * The `local` window kind (AGENTS.md "Windows, like IRC buffers"): the public
 * timeline narrowed to the posts the instance itself serves, its pages pulled by
 * the shared loader and its lines drawn by the shared scrollback
 * (src/views/TimelineWindow). The label is the accessible name of that log
 * region. Plain text typed while this window is active is a post: it goes out as
 * the window's own account and lands at the bottom of its own scrollback, which
 * is what src/state/postStatus does for every postable window.
 */

import type { JSX } from 'react';

import { publicTimeline } from '../../api/endpoints/timelines';
import { t } from '../../i18n/translate';
import { type WindowKindDefinition, postToWindow } from '../../state/windowKind';
import { TimelineWindow } from '../../views/TimelineWindow';
import type { FetchPage } from '../../views/useTimeline';

/** The instance's own posts, `local: true` on every request the window makes. */
const fetchLocalPage: FetchPage = async (session, page, signal) =>
  await publicTimeline(session, { local: true, page }, signal);

/** The local window: its buffer's lines, kept full by the local timeline. */
function LocalWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  return <TimelineWindow fetchPage={fetchLocalPage} label="local" windowId={windowId} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'local',
  topic: () => t('features.local.topic'),
  Component: LocalWindow,
  onPost: postToWindow,
};
