/**
 * Tests for the account picker's state (WFE-282): it starts closed, opening
 * stores the question, closing clears it (and a second close changes nothing),
 * and signing everyone out closes it.
 */
import { describe, expect, it } from 'vitest';

import type { AccountPick } from './accountPick';
import { initialAppState } from './appState';
import { appReducer } from './reducer';
import { LAIN } from '../test/splitDesk';

const PICK: AccountPick = { purpose: 'default', windowId: 'status' };

describe('the account picker state', () => {
  it('starts closed', () => {
    expect(initialAppState().accountPick).toBeNull();
  });

  it('opens on the question it is given', () => {
    const state = appReducer(initialAppState(), { type: 'openAccountPick', pick: PICK });

    expect(state.accountPick).toStrictEqual(PICK);
  });

  it('opens on a post question that holds the draft', () => {
    const pick: AccountPick = { purpose: 'post', windowId: 'status', draft: { text: 'hello' } };

    const state = appReducer(initialAppState(), { type: 'openAccountPick', pick });

    expect(state.accountPick).toStrictEqual(pick);
  });

  it('closes, and closing a closed picker is the same state', () => {
    const open = appReducer(initialAppState(), { type: 'openAccountPick', pick: PICK });

    const closed = appReducer(open, { type: 'closeAccountPick' });

    expect(closed.accountPick).toBeNull();
    expect(appReducer(closed, { type: 'closeAccountPick' })).toBe(closed);
  });

  it('closes when the last account signs out, and stays open while one is left', () => {
    const signedIn = appReducer(initialAppState(), {
      type: 'accounts',
      accounts: [LAIN],
      activeKey: LAIN.key,
    });
    const open = appReducer(signedIn, { type: 'openAccountPick', pick: PICK });

    const same = appReducer(open, { type: 'accounts', accounts: [LAIN], activeKey: LAIN.key });
    const gone = appReducer(open, { type: 'accounts', accounts: [], activeKey: null });

    expect(same.accountPick).toStrictEqual(PICK);
    expect(gone.accountPick).toBeNull();
  });
});
