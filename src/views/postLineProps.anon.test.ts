/**
 * Tests for who a window's lines are seen by when nobody is signed in
 * (WFE-340): a signed-out window's viewer has no account id but is on the
 * origin it reads, so local handles read as local; a window of an account no
 * longer signed in has neither.
 */
import { describe, expect, it } from 'vitest';

import { viewerFor } from './postLineProps';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { ANON_ORIGIN, ANON_THREAD_ID, anonState } from '../test/anonWindow';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

describe(viewerFor, () => {
  it('is nobody on the origin a signed-out window reads', () => {
    expect(viewerFor(anonState([]), ANON_THREAD_ID)).toStrictEqual({
      origin: ANON_ORIGIN,
      accountId: null,
    });
  });

  it('is nobody anywhere for a window of an account that is gone', () => {
    const ref: WindowRef = { kind: 'home', accountKey: 'gone#1', target: null };
    const state = appReducer(initialAppState(), {
      type: 'windows',
      action: { type: 'open', ref, title: 'home' },
    });

    expect(viewerFor(state, windowId(ref))).toStrictEqual({ origin: '', accountId: null });
  });
});
