/**
 * The `feedEditor` window kind (decision 13 and 14, WFE-242): a GUI for what
 * `/feed new|add|rm|rename|delete` do, as a view for any pane. Its ref is
 * `{ kind: 'feedEditor', accountKey: null, target: <feed id> }`, or the target
 * `new` for a feed not made yet, titled `edit ~<name>` or `new feed`
 * (src/state/feedEditorWindow). The window is a table of checkboxes — accounts
 * by sources — with a name field, hashtags and buttons; saving runs the
 * equivalent `/feed` lines. Opened by `/feed edit <name>`, a bare `/feed new`
 * and the ✎ button in a feed window's pane header. Nothing is posted into it:
 * the definition carries no `onPost`.
 */

import { FeedEditorWindow } from './FeedEditorWindow';
import type { WindowKindDefinition } from '../../state/windowKind';

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'feedEditor',
  topic: (window) => window.title,
  Component: FeedEditorWindow,
};
