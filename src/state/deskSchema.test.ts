/**
 * Tests for the desk snapshot schema (decision 17): what parses, and the
 * damage that makes a saved desk read as no desk at all.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { DeskSnapshotSchema } from './deskSchema';
import { toSnapshot } from './deskSnapshot';
import { builtDesk } from '../test/deskFixtures';

/** The built desk as plain JSON data, the way a store would hand it back. */
function stored(): Record<string, unknown> {
  const json: unknown = JSON.parse(JSON.stringify(toSnapshot(builtDesk(), 7)));
  return typeof json === 'object' && json !== null ? { ...json } : {};
}

/** Whether {@link value} is a valid snapshot. */
function valid(value: unknown): boolean {
  return v.safeParse(DeskSnapshotSchema, value).success;
}

describe('the desk snapshot schema', () => {
  it('accepts a snapshot of the built desk', () => {
    expect(valid(stored())).toBe(true);
  });

  it('refuses another version', () => {
    expect(valid({ ...stored(), version: 2 })).toBe(false);
    expect(valid({ ...stored(), version: 0 })).toBe(false);
  });

  it.each([null, 'desk', 7, [], {}])('refuses %j', (value) => {
    expect(valid(value)).toBe(false);
  });

  it('refuses a snapshot with no time or no windows', () => {
    expect(valid({ ...stored(), updatedAt: 'now' })).toBe(false);
    expect(valid({ ...stored(), windows: {} })).toBe(false);
  });

  it('refuses a window of an unknown kind', () => {
    const window = {
      id: 'x',
      title: 'x',
      ref: { kind: 'nope', accountKey: null, target: null },
      display: {},
    };

    expect(valid({ ...stored(), windows: [window] })).toBe(false);
  });

  it('accepts a window of the feed editor kind, so an open editor does not lose the desk', () => {
    const window = {
      id: 'feedEditor:-:f1',
      title: 'edit ~main',
      ref: { kind: 'feedEditor', accountKey: null, target: 'f1' },
      display: {},
    };

    expect(valid({ ...stored(), windows: [window] })).toBe(true);
  });

  it('refuses a layout with no desktops or a bad active index', () => {
    const layout = { desktops: [], active: 0, nextPaneSeq: 1 };

    expect(valid({ ...stored(), layout })).toBe(false);
    expect(
      valid({
        ...stored(),
        layout: {
          ...layout,
          desktops: [{ tree: null, floats: [], focusedPaneId: null }],
          active: -1,
        },
      }),
    ).toBe(false);
  });

  it('refuses a split ratio outside 0..1', () => {
    const tree = {
      type: 'split',
      dir: 'row',
      ratio: 2,
      a: { type: 'pane', paneId: 'p1', windowId: 'status' },
      b: { type: 'pane', paneId: 'p2', windowId: 'status' },
    };
    const layout = {
      desktops: [{ tree, floats: [], focusedPaneId: 'p1' }],
      active: 0,
      nextPaneSeq: 3,
    };

    expect(valid({ ...stored(), layout })).toBe(false);
  });
});
