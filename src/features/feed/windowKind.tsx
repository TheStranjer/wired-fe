/**
 * The `feed` window kind (decision 14): a saved feed's merged stream — every
 * source of the feed, each read as its own account, newest first — its pages
 * pulled by ./useFeed and its lines drawn by the shared scrollback
 * (src/views/BufferView). The ref's target is the feed's id and its title the
 * feed's name (`~main`), which is also the topic line. A feed window belongs to
 * no account, so plain text typed in it posts as the feed's posting account
 * (src/state/postAccountless): the feed's default, the global one, the only
 * account, or the one the reader picks in the account picker (WFE-284).
 */

import type { JSX } from 'react';

import { useFeed } from './useFeed';
import { postAccountless } from '../../state/postAccountless';
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
  onPost: postAccountless,
};
