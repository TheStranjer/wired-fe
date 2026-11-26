/**
 * Tests for dropSignedOut (WFE-243, WFE-281): an account that left the list
 * loses its feed sources and every posting default naming it; other accounts'
 * defaults stay, and nothing changes while nobody left.
 */
import { describe, expect, it } from 'vitest';

import { initialAppState } from './appState';
import type { Feeds } from './feeds';
import { appReducer } from './reducer';
import { dropSignedOut } from './signedOut';
import { ALICE, LAIN } from '../test/splitDesk';

const FEEDS: Feeds = [
  { id: 'f1', name: 'a', sources: [{ accountKey: ALICE.key, source: 'home' }], postAs: ALICE.key },
  { id: 'f2', name: 'b', sources: [], postAs: LAIN.key },
  { id: 'f3', name: 'c', sources: [] },
];

/** A session signed in as lain and alice with {@link postAs} as the global default. */
function session(postAs: string | null): ReturnType<typeof initialAppState> {
  const state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN, ALICE],
    activeKey: LAIN.key,
  });
  return appReducer(state, { type: 'settings', settings: { feeds: FEEDS, postAs } });
}

describe(dropSignedOut, () => {
  it('clears the feed and global defaults naming the account that left, and keeps the rest', () => {
    const before = session(ALICE.key);
    const after = { ...before, accounts: [LAIN] };

    const { settings } = dropSignedOut(before, after);

    expect(settings.postAs).toBeNull();
    expect(settings.feeds.map((feed) => feed.postAs)).toStrictEqual([
      undefined,
      LAIN.key,
      undefined,
    ]);
    expect(settings.feeds[0]?.sources).toStrictEqual([]);
  });

  it('keeps a global default that names an account still signed in', () => {
    const before = session(LAIN.key);

    expect(dropSignedOut(before, { ...before, accounts: [LAIN] }).settings.postAs).toBe(LAIN.key);
  });

  it('is the same state when nobody left', () => {
    const before = session(LAIN.key);

    expect(dropSignedOut(before, before)).toBe(before);
  });
});
