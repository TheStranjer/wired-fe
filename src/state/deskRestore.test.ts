/**
 * Tests for the `restore` action (decision 17): the saved desk takes the place
 * of the windows and the desktops, every restored window gets a scrollback, and
 * what the status window already printed stays.
 */
import { describe, expect, it } from 'vitest';

import { initialAppState, printAction } from './appState';
import { fromSnapshot, toSnapshot } from './deskSnapshot';
import { appReducer } from './reducer';
import { BOB_HOME_ID, LAIN_HOME_ID, builtDesk } from '../test/deskFixtures';

/** The built desk, saved and restored. */
function restored(): ReturnType<typeof fromSnapshot> {
  const desk = builtDesk();
  return fromSnapshot(toSnapshot(desk, 1), desk.accounts);
}

describe('a restore action', () => {
  it('puts the restored windows and desktops in place', () => {
    const desk = restored();

    const state = appReducer(initialAppState(), { type: 'restore', ...desk });

    expect(state.windows).toBe(desk.windows);
    expect(state.layout).toBe(desk.layout);
    expect(state.windows.activeId).toBe(BOB_HOME_ID);
  });

  it('gives every restored window a scrollback and keeps the status one', () => {
    const printed = appReducer(initialAppState(), printAction('status', 'info', 'hello'));

    const state = appReducer(printed, { type: 'restore', ...restored() });
    const lines = state.buffers.get('status')?.lines ?? [];

    expect(state.buffers.has(LAIN_HOME_ID)).toBe(true);
    expect(lines.flatMap((line) => (line.kind === 'system' ? [line.text] : []))).toStrictEqual([
      'hello',
    ]);
  });
});
