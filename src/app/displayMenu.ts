/**
 * The rows of a pane's display menu (WFE-236, decision 15) and the `/display`
 * line each one runs. Pure: the menu shows the window's effective values,
 * marks the ones the window overrides, and every row maps to a command line so
 * the click, the hotkey and the command are one path.
 */

import { resolveDisplay } from '../state/resolveDisplay';
import type { Settings } from '../state/settings';
import type { MenuItem } from '../ui/menuNav';
import type { WindowKind, WindowState } from '../windows/model';

/** The kinds of window that do not render posts, so have no display options. */
const NO_POSTS: readonly WindowKind[] = ['status', 'composer', 'feedEditor'];

/** Whether {@link win} renders posts, so the display menu applies to it. */
export function showsPosts(win: WindowState): boolean {
  return !NO_POSTS.includes(win.ref.kind);
}

/** The menu row id that clears every override. */
const RESET_ID = 'reset';

/** One row: ticked or not, with the `•` and the spoken name when overridden. */
function row(
  id: string,
  label: string,
  state: { checked: boolean; overridden: boolean },
): MenuItem {
  const { checked, overridden } = state;
  const spoken = `${label}, ${checked ? 'on' : 'off'}${overridden ? ', overridden' : ''}`;
  return {
    id,
    label: overridden ? `${label} •` : label,
    checked,
    name: spoken,
  };
}

/** The rows for {@link win} under the reader's {@link settings}. */
export function displayItems(
  settings: Pick<Settings, 'density' | 'avatars' | 'images'>,
  win: WindowState,
): readonly MenuItem[] {
  const { display } = win;
  const effective = resolveDisplay(settings, display);
  const cardsOverride = display.density === 'cards';
  const linesOverride = display.density === 'lines';
  const items: MenuItem[] = [
    row('cards', 'Cards', { checked: effective.density === 'cards', overridden: cardsOverride }),
    row('lines', 'Lines', { checked: effective.density === 'lines', overridden: linesOverride }),
    row('avatars', 'Avatars', {
      checked: effective.avatars,
      overridden: display.avatars !== undefined,
    }),
    row('images', 'Images', {
      checked: effective.images,
      overridden: display.images !== undefined,
    }),
  ];
  if (Object.keys(display).length > 0) {
    items.push({ id: RESET_ID, label: 'Reset to defaults' });
  }
  return items;
}

/** The `/display` line that choosing row {@link id} runs, given the effective values. */
export function displayLine(
  id: string,
  settings: Pick<Settings, 'density' | 'avatars' | 'images'>,
  win: WindowState,
): string {
  const effective = resolveDisplay(settings, win.display);
  switch (id) {
    case 'cards':
      return '/display density cards';
    case 'lines':
      return '/display density lines';
    case 'avatars':
      return `/display avatars ${effective.avatars ? 'off' : 'on'}`;
    case 'images':
      return `/display images ${effective.images ? 'off' : 'on'}`;
    default:
      return '/display reset';
  }
}
