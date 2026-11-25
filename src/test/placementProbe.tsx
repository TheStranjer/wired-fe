/**
 * A test probe that shows where the windows are (WFE-238): the titles of the
 * windows the active desktop holds in split panes, in pane order, and in
 * floats, so a test can read back what a click's placement did. A window that
 * is open but shown nowhere (hidden) appears in neither list.
 */
import type { JSX } from 'react';

import { useAppState } from '../state/StateContext';
import { activeDesktop } from '../windows/desktops';
import { panes } from '../windows/splitTree';

/** The probe's region name. */
export const PLACEMENT_PROBE = 'placement';

/** `panes: a, b | floats: c`, the titles of the windows each place holds (`-` for none). */
export function PlacementProbe(): JSX.Element {
  const state = useAppState();
  const desktop = activeDesktop(state.layout);
  const title = (id: string): string =>
    state.windows.windows.find((win) => win.id === id)?.title ?? id;
  const inPanes = desktop.tree === null ? [] : panes(desktop.tree).map((pane) => pane.windowId);
  const floats = desktop.floats.map((float) => float.windowId);
  const list = (ids: readonly string[]): string =>
    ids.length === 0 ? '-' : ids.map(title).join(', ');
  return (
    <section aria-label={PLACEMENT_PROBE}>
      {`panes: ${list(inPanes)} | floats: ${list(floats)}`}
    </section>
  );
}
