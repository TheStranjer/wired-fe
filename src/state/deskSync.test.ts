/**
 * Tests for the pure half of the desk sync (decision 17): the snapshot is the
 * desk plus the whole settings, the newest-wins decision over a missing,
 * unreadable, newer, older and equal server copy, the restore dropping what
 * the signed-in accounts cannot show, the text that tells a changed desk from
 * an unchanged one, and the PATCH body keyed by device class.
 */
import { describe, expect, it } from 'vitest';

import {
  type SyncDecision,
  type SyncSnapshot,
  decideSync,
  deskBody,
  fromSyncSnapshot,
  syncPatch,
  toSyncSnapshot,
} from './deskSync';
import { DEFAULT_SETTINGS } from './settings';
import { BOB_HOME_ID, LAIN, LAIN_HOME_ID, builtDesk } from '../test/deskFixtures';

/** The built desk with a theme set, as the server would hand it back through JSON. */
function remoteAt(updatedAt: number): unknown {
  const state = builtDesk();
  const settings = { ...state.settings, theme: 'lain' as const };
  return JSON.parse(JSON.stringify(toSyncSnapshot({ ...state, settings }, updatedAt)));
}

/** The snapshot {@link decideSync} applies for a server copy stamped {@link updatedAt}. */
function applied(updatedAt: number): SyncSnapshot {
  const decision = decideSync(0, remoteAt(updatedAt));
  if (decision.kind !== 'apply') {
    expect.fail('expected the server copy to be applied');
  }
  return decision.snapshot;
}

describe(toSyncSnapshot, () => {
  it('is the desk snapshot plus the whole settings', () => {
    const state = builtDesk();
    const snapshot = toSyncSnapshot(state, 1234);

    expect(snapshot.version).toBe(1);
    expect(snapshot.updatedAt).toBe(1234);
    expect(snapshot.settings).toStrictEqual(state.settings);
    expect(snapshot.windows.map((win) => win.id)).toContain(LAIN_HOME_ID);
    expect(snapshot.layout.desktops).toHaveLength(2);
  });
});

describe(decideSync, () => {
  const cases: readonly [string, number, unknown, SyncDecision['kind']][] = [
    ['the server has no copy', 100, undefined, 'push'],
    ['the server copy is newer', 100, remoteAt(200), 'apply'],
    ['the server copy is older', 100, remoteAt(50), 'push'],
    ['the server copy has the local stamp', 100, remoteAt(100), 'keep'],
    ['the server copy is a string', 100, 'desk', 'invalid'],
    ['the server copy is null', 100, null, 'invalid'],
    ['the server copy is an empty object', 100, {}, 'invalid'],
    [
      'the server copy is of another version',
      100,
      { ...(remoteAt(200) as object), version: 2 },
      'invalid',
    ],
    [
      'the server copy lacks its settings',
      100,
      { ...(remoteAt(200) as object), settings: undefined },
      'invalid',
    ],
  ];

  it.each(cases)('when %s it decides %s', (...row) => {
    const [, local, remote, kind] = row;

    expect(decideSync(local, remote).kind).toBe(kind);
  });

  it('hands over the parsed server copy with every default of the settings filled in', () => {
    const decision = decideSync(0, { ...(remoteAt(200) as object), settings: { theme: 'bnet' } });

    expect(decision).toMatchObject({
      kind: 'apply',
      snapshot: { updatedAt: 200, settings: { ...DEFAULT_SETTINGS, theme: 'bnet' } },
    });
  });
});

describe(fromSyncSnapshot, () => {
  it('restores the desk and the settings it carries', () => {
    const restored = fromSyncSnapshot(applied(200), builtDesk().accounts);

    expect(restored.settings.theme).toBe('lain');
    expect(restored.windows.windows.map((win) => win.id)).toContain(BOB_HOME_ID);
    expect(restored.layout.desktops).toHaveLength(2);
  });

  it('drops the windows of an account that is not signed in', () => {
    const restored = fromSyncSnapshot(applied(200), [LAIN]);

    expect(restored.windows.windows.map((win) => win.id)).not.toContain(BOB_HOME_ID);
  });
});

describe(deskBody, () => {
  it('is the same text for the same desk and settings, whatever the stamp or key order', () => {
    const state = builtDesk();
    const { theme, ...rest } = state.settings;
    const reordered = { ...state, settings: { theme, ...rest } };

    expect(deskBody(reordered)).toBe(deskBody(state));
  });

  it('differs when a setting or the layout differs', () => {
    const state = builtDesk();
    const themed = { ...state, settings: { ...state.settings, theme: 'bnet' as const } };
    const moved = { ...state, layout: { ...state.layout, active: 1 } };

    expect(deskBody(themed)).not.toBe(deskBody(state));
    expect(deskBody(moved)).not.toBe(deskBody(state));
  });
});

describe(syncPatch, () => {
  it.each(['desktop', 'mobile'] as const)(
    'keys the snapshot by the %s device class alone',
    (device) => {
      const snapshot = toSyncSnapshot(builtDesk(), 7);

      expect(syncPatch(device, snapshot)).toStrictEqual({ [device]: snapshot });
    },
  );
});
