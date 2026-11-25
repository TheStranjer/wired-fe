/**
 * Tests for the desk snapshot (decision 17): a round trip through JSON gives
 * the same windows and desktops, a signed-out account's windows and the panes
 * showing them are dropped, and nothing that does not hold together gets through.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { DeskSnapshotSchema } from './deskSchema';
import type { DeskSnapshot } from './deskSchema';
import { fromSnapshot, toSnapshot } from './deskSnapshot';
import {
  BOB_HOME_ID,
  FEED_ID,
  LAIN,
  LAIN_HOME_ID,
  THREAD_ID,
  builtDesk,
} from '../test/deskFixtures';
import { treeShape } from '../windows/desktopFixtures';

/** One saved desktop. */
type SavedDesktop = DeskSnapshot['layout']['desktops'][number];

/** The built desk as a snapshot, taken through the JSON a store would keep. */
function saved(): DeskSnapshot {
  return v.parse(DeskSnapshotSchema, JSON.parse(JSON.stringify(toSnapshot(builtDesk(), 1000))));
}

/** The saved desk with desktop {@link index} changed by {@link change}. */
function withDesktop(index: number, change: Partial<SavedDesktop>): DeskSnapshot {
  const snapshot = saved();
  const desktops = snapshot.layout.desktops.map((desktop, i) =>
    i === index ? { ...desktop, ...change } : desktop,
  );
  return { ...snapshot, layout: { ...snapshot.layout, desktops } };
}

/** The saved desk with its layout half changed by {@link change}. */
function withLayout(change: Partial<DeskSnapshot['layout']>): DeskSnapshot {
  const snapshot = saved();
  return { ...snapshot, layout: { ...snapshot.layout, ...change } };
}

describe(toSnapshot, () => {
  it('stamps the time and leaves the status window out', () => {
    const snapshot = toSnapshot(builtDesk(), 1234);

    expect(snapshot.version).toBe(1);
    expect(snapshot.updatedAt).toBe(1234);
    expect(snapshot.windows.map((win) => win.id)).toStrictEqual([
      LAIN_HOME_ID,
      BOB_HOME_ID,
      THREAD_ID,
      FEED_ID,
    ]);
  });

  it('keeps no unread count and no buffer', () => {
    expect(JSON.stringify(toSnapshot(builtDesk(), 1))).not.toMatch(/unread|highlight|buffer/);
  });
});

describe(fromSnapshot, () => {
  it('restores the very desk it saved', () => {
    const desk = builtDesk();

    const restored = fromSnapshot(saved(), desk.accounts);

    expect(restored.windows).toStrictEqual(desk.windows);
    expect(restored.layout).toStrictEqual(desk.layout);
  });

  it('keeps each window title and display overrides', () => {
    const { windows } = fromSnapshot(saved(), builtDesk().accounts);

    const thread = windows.windows.find((win) => win.id === THREAD_ID);

    expect(thread?.title).toBe('thread/a3');
    expect(thread?.display).toStrictEqual({ density: 'lines', images: false });
  });

  it('drops a signed-out account windows and the panes and floats showing them', () => {
    const { windows, layout } = fromSnapshot(saved(), [LAIN]);

    expect(windows.windows.map((win) => win.id)).toStrictEqual([
      'status',
      LAIN_HOME_ID,
      THREAD_ID,
      FEED_ID,
    ]);
    expect(layout.desktops[0]?.floats).toStrictEqual([]);
    expect(layout.desktops[0]?.focusedPaneId).toBe('p1');
    expect(windows.activeId).toBe(FEED_ID);
  });

  it('closes the panes of dropped windows on every desktop', () => {
    const { layout } = fromSnapshot(saved(), []);

    expect(layout.desktops.map((desktop) => desktop.focusedPaneId)).toStrictEqual(['p1', null]);
    expect(layout.desktops.map((desktop) => desktop.floats.length)).toStrictEqual([0, 0]);
  });

  it('opens on the status window when nothing is focused', () => {
    const snapshot = withDesktop(0, { tree: null, floats: [], focusedPaneId: null });

    expect(fromSnapshot(snapshot, []).windows.activeId).toBe('status');
  });

  it('keeps the active desktop in range', () => {
    expect(fromSnapshot(withLayout({ active: 9 }), builtDesk().accounts).layout.active).toBe(1);
  });

  it('moves the pane counter past every pane id', () => {
    const { layout } = fromSnapshot(withLayout({ nextPaneSeq: 1 }), builtDesk().accounts);

    expect(layout.nextPaneSeq).toBe(5);
  });

  it('keeps a larger pane counter', () => {
    const { layout } = fromSnapshot(withLayout({ nextPaneSeq: 40 }), builtDesk().accounts);

    expect(layout.nextPaneSeq).toBe(40);
  });

  it('does not count pane ids that are not numbered', () => {
    const tree = { type: 'pane' as const, paneId: 'main', windowId: FEED_ID };
    const snapshot = withDesktop(0, { tree, floats: [], focusedPaneId: 'main' });

    const { layout } = fromSnapshot(
      { ...snapshot, layout: { ...snapshot.layout, nextPaneSeq: 1 } },
      [LAIN],
    );

    expect(layout.nextPaneSeq).toBe(5);
  });

  it('focuses the first pane when the saved focus names none', () => {
    const { layout } = fromSnapshot(
      withDesktop(0, { focusedPaneId: 'nowhere' }),
      builtDesk().accounts,
    );

    expect(layout.desktops[0]?.focusedPaneId).toBe('p1');
  });

  it('clamps a float inside the viewport', () => {
    const floats = [{ paneId: 'p3', windowId: BOB_HOME_ID, rect: { x: 4, y: -2, w: 9, h: 0 } }];

    const { layout } = fromSnapshot(withDesktop(0, { floats }), builtDesk().accounts);

    expect(layout.desktops[0]?.floats[0]?.rect).toStrictEqual({ x: 0, y: 0, w: 1, h: 0.1 });
  });

  it('starts over with the status window when pane ids repeat', () => {
    const tree = saved().layout.desktops[0]?.tree ?? null;

    const { layout, windows } = fromSnapshot(withDesktop(1, { tree }), builtDesk().accounts);

    const [first] = layout.desktops;

    expect(layout.desktops).toHaveLength(1);
    expect(first === undefined ? null : treeShape(first)).toBe('p1:status');
    expect(windows.windows).toHaveLength(5);
  });

  it('opens each window once, and never the status window', () => {
    const snapshot = saved();
    const windows = snapshot.windows.flatMap((win) =>
      win.id === LAIN_HOME_ID
        ? [
            win,
            win,
            { ...win, id: 'status' },
            { ...win, id: 'x', ref: { ...win.ref, kind: 'status' as const } },
          ]
        : [win],
    );

    const restored = fromSnapshot({ ...snapshot, windows }, builtDesk().accounts);

    expect(restored.windows.windows.map((win) => win.id)).toStrictEqual([
      'status',
      LAIN_HOME_ID,
      BOB_HOME_ID,
      THREAD_ID,
      FEED_ID,
    ]);
  });

  it('opens every window read, never highlighted', () => {
    const { windows } = fromSnapshot(saved(), builtDesk().accounts);

    expect(windows.windows.every((win) => win.unread === 0 && !win.highlight)).toBe(true);
  });

  it('leaves unset display overrides unset', () => {
    const snapshot = saved();
    const windows = snapshot.windows.map((win) => ({
      ...win,
      display: { density: undefined, avatars: false },
    }));

    const restored = fromSnapshot({ ...snapshot, windows }, builtDesk().accounts);

    expect(restored.windows.windows[1]?.display).toStrictEqual({ avatars: false });
  });
});
