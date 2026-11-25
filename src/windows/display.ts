/**
 * Per-window display overrides (decision 15): the merge the `setDisplay`
 * action performs. Pure, like the rest of the layer; hands back the very same
 * state when nothing changes.
 */

import type { DisplayOverrides, WindowsState } from './model';

/** A change to a window's overrides: a key set to `undefined` clears it (inherit). */
export type DisplayChange = {
  readonly density?: DisplayOverrides['density'] | undefined;
  readonly avatars?: boolean | undefined;
  readonly images?: boolean | undefined;
};

/** {@link current} with {@link change} merged in: present values replace, `undefined` clears. */
function merged(current: DisplayOverrides, change: DisplayChange): DisplayOverrides {
  const density = 'density' in change ? change.density : current.density;
  const avatars = 'avatars' in change ? change.avatars : current.avatars;
  const images = 'images' in change ? change.images : current.images;
  return {
    ...(density === undefined ? {} : { density }),
    ...(avatars === undefined ? {} : { avatars }),
    ...(images === undefined ? {} : { images }),
  };
}

/** Whether two override records hold the same keys and values. */
function same(a: DisplayOverrides, b: DisplayOverrides): boolean {
  return a.density === b.density && a.avatars === b.avatars && a.images === b.images;
}

/**
 * Merge {@link change} into the overrides of window {@link id}. An unknown id
 * and a change that alters nothing leave the state as it was.
 */
export function setDisplay(state: WindowsState, id: string, change: DisplayChange): WindowsState {
  const existing = state.windows.find((win) => win.id === id);
  if (existing === undefined) {
    return state;
  }
  const display = merged(existing.display, change);
  if (same(display, existing.display)) {
    return state;
  }
  return {
    ...state,
    windows: state.windows.map((win) => (win.id === id ? { ...win, display } : win)),
  };
}
