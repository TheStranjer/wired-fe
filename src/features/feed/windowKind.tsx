/**
 * The `feed` window kind (decision 14): a saved feed's merged stream — every
 * source of the feed, each read as its own account, newest first — its pages
 * pulled by ./useFeed and its lines drawn by the shared scrollback
 * (src/views/BufferView). The ref's target is the feed's id and its title the
 * feed's name (`~main`), which is also the topic line. A feed window belongs to
 * no account, so nothing is posted into it: the definition carries no
 * `onPost`, and plain text typed while it is active goes nowhere.
 */

import type { JSX } from 'react';

import { useFeed } from './useFeed';
import type { WindowKindDefinition } from '../../state/windowKind';
import { BufferView } from '../../views/BufferView';

/** The feed window: its buffer's lines, kept full by the feed's sources. */
function FeedWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  useFeed(windowId);
  return <BufferView label="feed" windowId={windowId} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'feed',
  topic: (window) => window.title,
  Component: FeedWindow,
};
