/**
 * Tests for placement (decision 13): every placement of an open window —
 * `here` in the focused pane, `vsplit` and `split` in a new pane beside or
 * under it, `float` in a new float, `hidden` in the list only — with the
 * window list and desktops moved by the real transitions; opening a window
 * that is already open; which placement wins (`--in`, the kind's setting, the
 * default); and the per-kind map's own helpers.
 */
import { describe, expect, it } from 'vitest';

import type { SyncSlice } from './layoutSync';
import {
  type OpenAction,
  type PlacementSettings,
  chosenPlacement,
  isPlaceableKind,
  isPlacement,
  kindPlacements,
  openPlaced,
  placeWindow,
  resolvePlacement,
  withKindPlacement,
} from './placement';
import { shownPanes } from '../windows/desktopPanes';
import { activeDesktop, focusedWindowId, initialDesktops } from '../windows/desktops';
import { STATUS_WINDOW_ID, initialWindowsState, windowId } from '../windows/model';
import { panes } from '../windows/splitTree';

/** A session with only the status window, shown. */
const START: SyncSlice = {
  windows: initialWindowsState(),
  layout: initialDesktops(STATUS_WINDOW_ID),
};

/** The ask to open the #rust window. */
const RUST: OpenAction = {
  type: 'open',
  ref: { kind: 'hashtag', accountKey: 'a#1', target: 'rust' },
  title: '#rust',
};

/** The id of the #rust window. */
const RUST_ID = windowId(RUST.ref);

/** The ids of the windows the active desktop shows, in pane order. */
function shown(slice: SyncSlice): readonly string[] {
  return shownPanes(activeDesktop(slice.layout)).map((pane) => pane.windowId);
}

/** The direction of the root split of the active desktop, or `pane` when it is one pane. */
function direction(slice: SyncSlice): string {
  const { tree } = activeDesktop(slice.layout);
  return tree?.type === 'split' ? tree.dir : 'pane';
}

/** The settings that decide placement, with {@link openIn} as default. */
function settings(
  openIn: PlacementSettings['openIn'],
  by: PlacementSettings['openInByKind'],
): PlacementSettings {
  return { openIn, openInByKind: by };
}

describe(placeWindow, () => {
  const hiddenRust = openPlaced(START, RUST, 'hidden');

  it('shows the window in the focused pane for here, replacing what was there', () => {
    const placed = placeWindow(hiddenRust, RUST_ID, 'here');

    expect(shown(placed)).toStrictEqual([RUST_ID]);
    expect(placed.windows.activeId).toBe(RUST_ID);
  });

  it('splits the focused pane side by side for vsplit and focuses the new pane', () => {
    const placed = placeWindow(hiddenRust, RUST_ID, 'vsplit');

    expect(direction(placed)).toBe('row');
    expect(shown(placed)).toStrictEqual([STATUS_WINDOW_ID, RUST_ID]);
    expect(focusedWindowId(placed.layout)).toBe(RUST_ID);
    expect(placed.windows.activeId).toBe(RUST_ID);
  });

  it('stacks the new pane for split', () => {
    const placed = placeWindow(hiddenRust, RUST_ID, 'split');

    expect(direction(placed)).toBe('column');
    expect(shown(placed)).toStrictEqual([STATUS_WINDOW_ID, RUST_ID]);
    expect(placed.windows.activeId).toBe(RUST_ID);
  });

  it('opens a new float for float, leaving the tree as it was', () => {
    const placed = placeWindow(hiddenRust, RUST_ID, 'float');
    const { floats, tree } = activeDesktop(placed.layout);
    const tiled = tree === null ? [] : panes(tree);

    expect(floats.map((float) => float.windowId)).toStrictEqual([RUST_ID]);
    expect(tiled.map((pane) => pane.windowId)).toStrictEqual([STATUS_WINDOW_ID]);
    expect(focusedWindowId(placed.layout)).toBe(RUST_ID);
    expect(placed.windows.activeId).toBe(RUST_ID);
  });

  it('changes nothing for hidden', () => {
    expect(placeWindow(hiddenRust, RUST_ID, 'hidden')).toBe(hiddenRust);
  });

  it('changes nothing for a window that is not open', () => {
    expect(placeWindow(START, RUST_ID, 'float')).toBe(START);
  });
});

describe(openPlaced, () => {
  it('opens the window in the list without showing or activating it for hidden', () => {
    const placed = openPlaced(START, RUST, 'hidden');

    expect(placed.windows.windows.map((win) => win.id)).toStrictEqual([STATUS_WINDOW_ID, RUST_ID]);
    expect(placed.windows.activeId).toBe(STATUS_WINDOW_ID);
    expect(placed.layout).toBe(START.layout);
    expect(shown(placed)).toStrictEqual([STATUS_WINDOW_ID]);
  });

  it('opens and shows the window as the plain open does for here', () => {
    const placed = openPlaced(START, RUST, 'here');

    expect(shown(placed)).toStrictEqual([RUST_ID]);
    expect(placed.windows.activeId).toBe(RUST_ID);
  });

  it('opens and splits for vsplit in one step', () => {
    const placed = openPlaced(START, RUST, 'vsplit');

    expect(placed.windows.windows).toHaveLength(2);
    expect(shown(placed)).toStrictEqual([STATUS_WINDOW_ID, RUST_ID]);
    expect(placed.windows.activeId).toBe(RUST_ID);
  });

  it('leaves a window that is already open as it is, and does not activate it for hidden', () => {
    const open = openPlaced(START, RUST, 'hidden');

    const again = openPlaced(open, RUST, 'hidden');

    expect(again.windows).toBe(open.windows);
    expect(again.layout).toBe(open.layout);
  });

  it('shows a window that is already open where asked', () => {
    const open = openPlaced(START, RUST, 'hidden');

    const placed = openPlaced(open, RUST, 'float');

    expect(placed.windows.windows).toHaveLength(2);
    expect(activeDesktop(placed.layout).floats).toHaveLength(1);
  });
});

describe('which placement wins', () => {
  const by = { thread: 'vsplit' } as const;

  it('takes the override over the kind’s setting and the default', () => {
    expect(resolvePlacement(settings('split', by), 'thread', 'float')).toBe('float');
  });

  it('takes the kind’s setting over the default', () => {
    expect(resolvePlacement(settings('split', by), 'thread', null)).toBe('vsplit');
  });

  it('takes the default for a kind with no setting of its own', () => {
    expect(resolvePlacement(settings('split', by), 'dm', null)).toBe('split');
  });

  it('floats a composer unless the reader or --in says otherwise', () => {
    expect(resolvePlacement(settings('here', {}), 'composer', null)).toBe('float');
    expect(resolvePlacement(settings('here', { composer: 'here' }), 'composer', null)).toBe('here');
    expect(resolvePlacement(settings('here', {}), 'composer', 'vsplit')).toBe('vsplit');
  });

  it('reports no choice for a kind the reader did not place, so a command can keep its own default', () => {
    expect(chosenPlacement(settings('float', by), 'dm', null)).toBeNull();
    expect(chosenPlacement(settings('float', by), 'thread', null)).toBe('vsplit');
    expect(chosenPlacement(settings('float', by), 'thread', 'hidden')).toBe('hidden');
  });
});

describe('the words placement is spelled with', () => {
  it('knows a placement from any other word', () => {
    expect(isPlacement('vsplit')).toBe(true);
    expect(isPlacement('sideways')).toBe(false);
  });

  it('knows a kind that can be placed, and not the status window', () => {
    expect(isPlaceableKind('thread')).toBe(true);
    expect(isPlaceableKind('status')).toBe(false);
    expect(isPlaceableKind('toaster')).toBe(false);
  });

  it('keeps the placements of the kinds that are real, and nothing for nothing stored', () => {
    expect(kindPlacements({ thread: 'float', toaster: 'split' })).toStrictEqual({
      thread: 'float',
    });
    expect(kindPlacements({})).toStrictEqual({});
  });

  it('sets, replaces and takes back one kind’s placement, keeping the others', () => {
    const one = withKindPlacement({ dm: 'hidden' }, 'thread', 'float');
    const two = withKindPlacement(one, 'thread', 'split');
    const back = withKindPlacement(two, 'thread', null);

    expect(one).toStrictEqual({ dm: 'hidden', thread: 'float' });
    expect(two).toStrictEqual({ dm: 'hidden', thread: 'split' });
    expect(back).toStrictEqual({ dm: 'hidden' });
  });
});
