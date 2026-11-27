/**
 * Tests for signed-out windows and the desk (WFE-340, decision 17): a window
 * under an `anon:<origin>` key, and the pane or float showing it, never reach
 * the snapshot that is saved locally and pushed to the sync, while everything
 * else in the desk does.
 */
import { describe, expect, it } from 'vitest';

import { anonKey } from './anonAccount';
import type { AppState } from './appState';
import { toSnapshot } from './deskSnapshot';
import { toSyncSnapshot } from './deskSync';
import { appReducer } from './reducer';
import { LAIN, builtDesk } from '../test/deskFixtures';
import { shownPanes } from '../windows/desktopPanes';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ANON: WindowRef = { kind: 'thread', accountKey: anonKey(LAIN.origin), target: '5' };
const ANON_ID = windowId(ANON);

/** The built desk with a signed-out thread open in a pane of its own. */
function withAnonPane(): AppState {
  const opened = appReducer(builtDesk(), {
    type: 'windows',
    action: { type: 'open', ref: ANON, title: 'thread/5' },
  });
  return appReducer(opened, {
    type: 'layout',
    action: { type: 'split', dir: 'row', windowId: ANON_ID },
  });
}

/** The ids of the windows every desktop of {@link state} shows. */
function shownIds(state: AppState): readonly string[] {
  return state.layout.desktops.flatMap((desktop) =>
    shownPanes(desktop).map((pane) => pane.windowId),
  );
}

/** The ids of the windows every desktop of the snapshot of {@link state} shows. */
function savedIds(state: AppState): readonly string[] {
  const { desktops } = toSnapshot(state, 1).layout;
  return desktops.flatMap((desktop) => shownPanes(desktop).map((pane) => pane.windowId));
}

describe('toSnapshot with a signed-out window', () => {
  it('shows the window in the live desk, which is what makes the test mean something', () => {
    expect(shownIds(withAnonPane())).toContain(ANON_ID);
  });

  it('leaves the window out of the saved windows', () => {
    const snapshot = toSnapshot(withAnonPane(), 1);

    expect(snapshot.windows.map((win) => win.id)).not.toContain(ANON_ID);
    expect(snapshot.windows.map((win) => win.id)).toStrictEqual(
      toSnapshot(builtDesk(), 1).windows.map((win) => win.id),
    );
  });

  it('leaves the pane showing it out of every saved desktop, and keeps the others', () => {
    const saved = savedIds(withAnonPane());

    expect(saved).not.toContain(ANON_ID);
    expect(saved).toStrictEqual(shownIds(withAnonPane()).filter((id) => id !== ANON_ID));
  });

  it('keeps a focus that exists', () => {
    const desktop = toSnapshot(withAnonPane(), 1).layout.desktops[0];
    const ids = desktop === undefined ? [] : shownPanes(desktop).map((pane) => pane.paneId);

    expect(ids).toContain(desktop?.focusedPaneId);
  });

  it('reaches the synced snapshot the same way', () => {
    const synced = toSyncSnapshot(withAnonPane(), 1);

    expect(JSON.stringify(synced)).not.toContain('anon:');
  });

  it('is the very desktops when no window is signed out', () => {
    const desk = builtDesk();

    expect(toSnapshot(desk, 1).layout.desktops).toBe(desk.layout.desktops);
  });
});
