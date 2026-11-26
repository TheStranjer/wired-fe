/**
 * Tests for the posting-default words and patch (WFE-281, WFE-282): the line
 * that says who a window posts as, the line that confirms a new default, and
 * the settings patch for a feed's default or the global one.
 */
import { describe, expect, it } from 'vitest';

import { type AppState, initialAppState } from './appState';
import type { FeedSpec } from './feeds';
import { postingLine, postingPatch, postingSetLine } from './postingDefault';
import { appReducer } from './reducer';
import { LAIN } from '../test/splitDesk';
import { activeWindow } from '../windows/model';

const FEED: FeedSpec = { id: 'f1', name: 'main', sources: [] };

/** A session signed in as lain only. */
function lainOnly(): AppState {
  return appReducer(initialAppState(), { type: 'accounts', accounts: [LAIN], activeKey: LAIN.key });
}

describe(postingLine, () => {
  it('names the only account for the status window', () => {
    const state = lainOnly();

    expect(postingLine(state, activeWindow(state.windows))).toBe(
      'posts as @lain@wired.example (only account)',
    );
  });

  it('is null when nobody is signed in', () => {
    const state = initialAppState();

    expect(postingLine(state, activeWindow(state.windows))).toBeNull();
  });
});

describe(postingSetLine, () => {
  it('words a feed default and a global one', () => {
    expect(postingSetLine('main', 'a@x')).toBe('~main posts as @a@x (feed default)');
    expect(postingSetLine(null, 'a@x')).toBe('posts as @a@x (global default)');
  });
});

describe(postingPatch, () => {
  it('sets or clears the global default without a feed', () => {
    expect(postingPatch([FEED], null, LAIN.key)).toStrictEqual({ postAs: LAIN.key });
    expect(postingPatch([FEED], null, null)).toStrictEqual({ postAs: null });
  });

  it('sets or clears the default of a feed', () => {
    expect(postingPatch([FEED], 'f1', LAIN.key)).toStrictEqual({
      feeds: [{ ...FEED, postAs: LAIN.key }],
    });
    expect(postingPatch([{ ...FEED, postAs: LAIN.key }], 'f1', null)).toStrictEqual({
      feeds: [{ ...FEED, postAs: undefined }],
    });
  });
});
