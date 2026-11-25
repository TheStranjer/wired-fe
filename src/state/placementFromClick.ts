/**
 * Placement for clicks (decision 13): a click that opens a window (a nick, a
 * mention or hashtag in a body, a notification's actor or excerpt, a name in
 * the people list) places it by the modifier held, like a typed `--in`. A
 * plain click follows the configured placement; Ctrl or Cmd opens a float,
 * Shift splits beside the focused pane, the middle button opens the window
 * hidden. Pure: a click and the settings in, the app action out.
 */

import {
  type OpenAction,
  type Placement,
  type PlacementSettings,
  resolvePlacement,
} from './placement';
import type { AppAction } from './reducer';
import { type ClickModifiers, isMiddleClick } from '../lib/clickModifiers';

/** The placement {@link click} asks for, or {@link configured} for a plain click. */
export function placementFromClick(click: ClickModifiers, configured: Placement): Placement {
  if (isMiddleClick(click)) {
    return 'hidden';
  }
  if (click.ctrlKey || click.metaKey) {
    return 'float';
  }
  return click.shiftKey ? 'vsplit' : configured;
}

/**
 * The app action that opens {@link open} as {@link click} places it: the
 * window's kind setting (or the default) for a plain click. `here` is the
 * plain open; the others are the `openPlaced` action.
 */
export function clickOpen(
  settings: PlacementSettings,
  open: OpenAction,
  click: ClickModifiers,
): AppAction {
  const configured = resolvePlacement(settings, open.ref.kind, null);
  const placement = placementFromClick(click, configured);
  return placement === 'here'
    ? { type: 'windows', action: open }
    : { type: 'openPlaced', action: open, placement };
}
