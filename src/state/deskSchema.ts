/**
 * The shape of a saved desk (decision 17), as valibot schemas: what
 * `localStorage` may hold under a device class's desk key, and the type a
 * snapshot has once parsed. Every collection is an array, never an object
 * keyed by ids, so two devices' copies can merge. Anything that does not
 * parse (corrupt, or written by another version) reads as no snapshot.
 */
import * as v from 'valibot';

import type { WindowRef } from '../windows/model';
import type { SplitTree } from '../windows/splitTree';

/** The version a snapshot carries; a different one is ignored, never migrated. */
export const DESK_VERSION = 1;

/** The kinds of window a ref can name, one of each {@link WindowRef} kind. */
const KindSchema = v.picklist([
  'status',
  'home',
  'local',
  'federated',
  'notifications',
  'thread',
  'hashtag',
  'profile',
  'dm',
  'search',
  'composer',
  'feed',
]);

/** What a window shows. */
const WindowRefSchema: v.GenericSchema<unknown, WindowRef> = v.object({
  kind: KindSchema,
  accountKey: v.nullable(v.string()),
  target: v.nullable(v.string()),
});

/** A window's display overrides; a missing key inherits the setting. */
const DisplaySchema = v.object({
  density: v.optional(v.picklist(['cards', 'lines'])),
  avatars: v.optional(v.boolean()),
  images: v.optional(v.boolean()),
});

/** One saved window: no buffer, unread or scroll position, only what it is. */
const DeskWindowSchema = v.object({
  id: v.string(),
  title: v.string(),
  ref: WindowRefSchema,
  display: DisplaySchema,
});

/** A split tree: a pane showing a window, or two subtrees. */
const SplitTreeSchema: v.GenericSchema<unknown, SplitTree> = v.variant('type', [
  v.object({ type: v.literal('pane'), paneId: v.string(), windowId: v.string() }),
  v.object({
    type: v.literal('split'),
    dir: v.picklist(['row', 'column']),
    ratio: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
    a: v.lazy(() => SplitTreeSchema),
    b: v.lazy(() => SplitTreeSchema),
  }),
]);

/** A float's rectangle, in fractions of the viewport. */
const FloatRectSchema = v.object({
  x: v.number(),
  y: v.number(),
  w: v.number(),
  h: v.number(),
});

/** One desktop: its tree, its floats and the focused pane. */
const DesktopSchema = v.object({
  tree: v.nullable(SplitTreeSchema),
  floats: v.pipe(
    v.array(v.object({ paneId: v.string(), windowId: v.string(), rect: FloatRectSchema })),
    v.readonly(),
  ),
  focusedPaneId: v.nullable(v.string()),
});

/** The whole saved desk, version {@link DESK_VERSION}. */
export const DeskSnapshotSchema = v.object({
  version: v.literal(DESK_VERSION),
  updatedAt: v.number(),
  windows: v.pipe(v.array(DeskWindowSchema), v.readonly()),
  layout: v.object({
    desktops: v.pipe(v.array(DesktopSchema), v.minLength(1), v.readonly()),
    active: v.pipe(v.number(), v.integer(), v.minValue(0)),
    nextPaneSeq: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
});

/** A saved desk: the windows that are open and how the desktops show them. */
export type DeskSnapshot = v.InferOutput<typeof DeskSnapshotSchema>;
