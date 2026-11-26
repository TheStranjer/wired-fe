/**
 * The `home` window kind (AGENTS.md "Windows, like IRC buffers"): one account's
 * home timeline, its pages pulled by the shared loader and its lines drawn by
 * the shared scrollback (src/views/TimelineWindow). The label is the accessible
 * name of that log region, the way the status window names itself `status`.
 * Plain text typed while this window is active is a post: it goes out as the
 * window's own account and lands at the bottom of its own scrollback, which is
 * what src/state/postStatus does for every postable window.
 */

import type { JSX } from 'react';

import { homeTimeline } from '../../api/endpoints/timelines';
import { useT } from '../../i18n/I18nProvider';
import { t } from '../../i18n/translate';
import { type WindowKindDefinition, postToWindow } from '../../state/windowKind';
import { TimelineWindow } from '../../views/TimelineWindow';

/** The home window: its buffer's lines, kept full by the home timeline endpoint. */
function HomeWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  const label = useT()('features.home.log_label');
  return <TimelineWindow fetchPage={homeTimeline} label={label} windowId={windowId} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'home',
  topic: () => t('features.home.topic'),
  Component: HomeWindow,
  onPost: postToWindow,
};
