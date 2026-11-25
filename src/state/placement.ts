/**
 * Placement (decision 13): where a window that is being opened goes. `here`
 * shows it in the focused pane (what opening always did), `vsplit` and
 * `split` split the focused pane and show it in the new one, `float` opens it
 * in a new float and `hidden` opens it without showing or focusing it, like
 * an IRC buffer in the background. Pure: the choice of placement (`--in`, then
 * the per-kind setting, then the default) and the transitions that carry it
 * out on the window list and the desktops, which the app reducer applies.
 */

import { type SyncSlice, applyWindowsAction } from './layoutSync';
import { floatFocused, splitFocused } from '../windows/desktops';
import type { DesktopsState } from '../windows/desktops';
import { withActive, windowId } from '../windows/model';
import type { WindowKind } from '../windows/model';
import { windowsReducer } from '../windows/reducer';
import type { WindowsAction } from '../windows/reducer';

/** Where a window opens: the focused pane, beside it, under it, in a float, or nowhere. */
export type Placement = 'here' | 'vsplit' | 'split' | 'float' | 'hidden';

/** Every placement, the default first, as the commands and `/set` spell them. */
export const PLACEMENTS = [
  'here',
  'vsplit',
  'split',
  'float',
  'hidden',
] as const satisfies readonly Placement[];

/** The kinds a reader can give a placement of their own: every kind but the status window. */
export const PLACEABLE_KINDS: readonly WindowKind[] = [
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
  'people',
  'media',
];

/** The per-kind placements a reader has chosen; a kind not listed follows the default. */
export type KindPlacements = Readonly<Partial<Record<WindowKind, Placement>>>;

/** The part of the settings that decides placement. */
export type PlacementSettings = {
  /** Where a window opens when nothing else says. */
  readonly openIn: Placement;
  /** Where windows of a kind open, over {@link openIn}. */
  readonly openInByKind: KindPlacements;
};

/** The `open` kind of window action: what the open commands ask the window list for. */
export type OpenAction = Extract<WindowsAction, { readonly type: 'open' }>;

/** Whether {@link word} spells a placement. */
export function isPlacement(word: string): word is Placement {
  const words: readonly string[] = PLACEMENTS;
  return words.includes(word);
}

/** Whether {@link word} names a kind that can have a placement of its own. */
export function isPlaceableKind(word: string): word is WindowKind {
  const words: readonly string[] = PLACEABLE_KINDS;
  return words.includes(word);
}

/** What was stored as per-kind placements, as the map of the kinds that are real. */
export function kindPlacements(stored: Record<string, Placement>): KindPlacements {
  const kept: Partial<Record<WindowKind, Placement>> = {};
  for (const [kind, placement] of Object.entries(stored)) {
    if (isPlaceableKind(kind)) {
      kept[kind] = placement;
    }
  }
  return kept;
}

/** {@link current} with {@link kind} placed as {@link placement} says; null puts it back to following the default. */
export function withKindPlacement(
  current: KindPlacements,
  kind: WindowKind,
  placement: Placement | null,
): KindPlacements {
  const next: Partial<Record<WindowKind, Placement>> = {};
  for (const each of PLACEABLE_KINDS) {
    const chosen = each === kind ? placement : current[each];
    if (chosen !== null && chosen !== undefined) {
      next[each] = chosen;
    }
  }
  return next;
}

/** The placement the reader asked for a window of {@link kind}, by {@link override} or per kind; null when neither says. */
export function chosenPlacement(
  settings: PlacementSettings,
  kind: WindowKind,
  override: Placement | null,
): Placement | null {
  return override ?? settings.openInByKind[kind] ?? null;
}

/** The kinds whose placement starts as something other than `openIn`: a composer pops up over what you are reading, and so does a media viewer. */
const KIND_DEFAULTS: KindPlacements = { composer: 'float', media: 'float' };

/** Where a window of {@link kind} opens: {@link override}, else its kind's setting, else the kind's own default, else `openIn`. */
export function resolvePlacement(
  settings: PlacementSettings,
  kind: WindowKind,
  override: Placement | null,
): Placement {
  return chosenPlacement(settings, kind, override) ?? KIND_DEFAULTS[kind] ?? settings.openIn;
}

/** The part of the settings that places a reply composer: placement's own plus `replyIn`. */
export type ReplySettings = PlacementSettings & {
  /** Where a reply composer opens when `--in` and `openIn.composer` say nothing. */
  readonly replyIn: Placement;
};

/**
 * Where the composer a reply opens goes (WFE-244): {@link override}, else the
 * `composer` kind's setting, else `replyIn` — not the global default, which
 * would put a reply over the post it answers.
 */
export function resolveReplyPlacement(
  settings: ReplySettings,
  override: Placement | null,
): Placement {
  return chosenPlacement(settings, 'composer', override) ?? settings.replyIn;
}

/** The slice with the desktops changed by {@link change} and window {@link id} shown and active. */
function shown(
  slice: SyncSlice,
  id: string,
  change: (layout: DesktopsState) => DesktopsState,
): SyncSlice {
  return { windows: withActive(slice.windows, id), layout: change(slice.layout) };
}

/**
 * Shows the open window {@link id} as {@link placement} says. `here` puts it in
 * the focused pane; `vsplit` and `split` give it a new pane beside or under
 * the focused one, and `float` a new float, each taking focus; `hidden`
 * changes nothing. A window that is not open changes nothing.
 */
export function placeWindow(slice: SyncSlice, id: string, placement: Placement): SyncSlice {
  if (!slice.windows.windows.some((win) => win.id === id)) {
    return slice;
  }
  switch (placement) {
    case 'here':
      return applyWindowsAction(slice, { type: 'activate', id });
    case 'hidden':
      return slice;
    case 'vsplit':
      return shown(slice, id, (layout) => splitFocused(layout, 'row', id));
    case 'split':
      return shown(slice, id, (layout) => splitFocused(layout, 'column', id));
    case 'float':
      return shown(slice, id, (layout) => floatFocused(splitFocused(layout, 'row', id)));
  }
}

/**
 * Opens the window {@link action} names and places it: the window joins the
 * list without becoming active (one that is already open stays as it is),
 * and {@link placeWindow} then shows it.
 */
export function openPlaced(slice: SyncSlice, action: OpenAction, placement: Placement): SyncSlice {
  const id = windowId(action.ref);
  const known = slice.windows.windows.some((win) => win.id === id);
  const opened = known
    ? slice.windows
    : { ...windowsReducer(slice.windows, action), activeId: slice.windows.activeId };
  return placeWindow({ windows: opened, layout: slice.layout }, id, placement);
}
