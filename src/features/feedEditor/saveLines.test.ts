/**
 * Tests for the `/feed` lines a feed editor saves with (decision 6 and 14):
 * one `/feed new` for a new feed; for a saved feed a `/feed rm` for what was
 * unticked, a `/feed add` for what was ticked and a `/feed rename` for a new
 * name, in that order and only when there is something to say.
 */
import { describe, expect, it } from 'vitest';

import { type EditorDraft, draftOf } from './editorDraft';
import { saveLines } from './saveLines';
import type { FeedSourceRef, FeedSpec } from '../../state/feeds';
import { ALICE, LAIN } from '../../test/splitDesk';

const ACCOUNTS = [LAIN, ALICE];
const HOME: FeedSourceRef = { accountKey: LAIN.key, source: 'home' };
const MENTIONS: FeedSourceRef = { accountKey: LAIN.key, source: 'mentions' };
const RUST: FeedSourceRef = { accountKey: ALICE.key, source: 'tag:rust' };
const FEED: FeedSpec = { id: 'f1', name: 'main', sources: [HOME, MENTIONS] };

/** {@link FEED}'s draft with the given changes. */
function draft(change: Partial<EditorDraft>): EditorDraft {
  return { ...draftOf(FEED), ...change };
}

describe(saveLines, () => {
  it('makes a new feed with one /feed new naming every ticked source', () => {
    const lines = saveLines(null, { name: ' fresh ', sources: [HOME, RUST] }, ACCOUNTS);

    expect(lines).toStrictEqual([
      '/feed new fresh @lain@wired.example:home @alice@wired.example:tag:rust',
    ]);
  });

  it('makes a new feed with no sources from a name alone', () => {
    expect(saveLines(null, { name: 'quiet', sources: [] }, ACCOUNTS)).toStrictEqual([
      '/feed new quiet',
    ]);
  });

  it('says nothing for a saved feed that was not changed', () => {
    expect(saveLines(FEED, draftOf(FEED), ACCOUNTS)).toStrictEqual([]);
  });

  it('removes what was unticked, adds what was ticked, then renames', () => {
    const changed = draft({ name: 'prime', sources: [HOME, RUST] });

    expect(saveLines(FEED, changed, ACCOUNTS)).toStrictEqual([
      '/feed rm main @lain@wired.example:mentions',
      '/feed add main @alice@wired.example:tag:rust',
      '/feed rename main prime',
    ]);
  });

  it('says only the add when sources were only ticked', () => {
    const changed = draft({ sources: [HOME, MENTIONS, RUST] });

    expect(saveLines(FEED, changed, ACCOUNTS)).toStrictEqual([
      '/feed add main @alice@wired.example:tag:rust',
    ]);
  });

  it('says only the rename when only the name changed', () => {
    expect(saveLines(FEED, draft({ name: 'Main' }), ACCOUNTS)).toStrictEqual([
      '/feed rename main Main',
    ]);
  });

  it('leaves out the sources of an account that is not signed in', () => {
    const ghost: FeedSourceRef = { accountKey: 'gone', source: 'local' };

    expect(saveLines(FEED, draft({ sources: [HOME, MENTIONS, ghost] }), ACCOUNTS)).toStrictEqual(
      [],
    );
  });
});
