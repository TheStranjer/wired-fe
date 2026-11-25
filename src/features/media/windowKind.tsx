/**
 * The `media` window kind (decision 13, WFE-263): one attachment of a post at
 * full size, for any pane and a float by default. Its ref is
 * `{ kind: 'media', accountKey: <the post's account>, target: '<statusId>:<n>' }`
 * with `n` the 1-based attachment (src/state/mediaWindow), titled
 * `media [c1] 1/3`. The window fetches its post itself, so a restored or synced
 * desk shows it with no scrollback. Opened by `/media [label] [n]` and its
 * `v` key; nothing is posted into it: the definition carries no `onPost`, so
 * plain text typed here gets the usual refusal.
 */

import { MediaWindow } from './MediaWindow';
import type { WindowKindDefinition } from '../../state/windowKind';

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'media',
  topic: (window) => window.title,
  Component: MediaWindow,
};
