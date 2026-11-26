/**
 * Tests for the empty word (WFE-301): after a space only a provider that asks
 * to be consulted about it ({@link Provider.bare}) completes, with its
 * candidates for the word typed so far being none; every other provider
 * keeps Tab after a space for the browser, as before.
 */
import { describe, expect, it } from 'vitest';

import { type Provider, candidatesAt, startCompletion } from './complete';
import { suggestionView } from './suggest';

/** A provider that accepts any word after the first, bare or not. */
function afterFirst(bare: boolean): Provider {
  const base: Provider = {
    accepts: (_word, isFirstWord) => !isFirstWord,
    candidates: (word) => ['one', 'two'].filter((candidate) => candidate.startsWith(word)),
    describe: (candidate) => ({
      word: candidate,
      label: candidate,
      description: `the ${candidate}`,
    }),
  };
  return bare ? { ...base, bare: true } : base;
}

describe('the empty word', () => {
  it('is left alone when no provider asks for it', () => {
    expect(startCompletion('/cmd ', 5, [afterFirst(false)])).toBeNull();
    expect(candidatesAt('/cmd ', 5, [afterFirst(false)])).toBeNull();
  });

  it('is completed by a bare provider to its first candidate', () => {
    expect(startCompletion('/cmd ', 5, [afterFirst(true)])).toMatchObject({
      text: '/cmd one ',
      cursor: 9,
    });
  });

  it('opens the suggestion list of a bare provider', () => {
    const view = suggestionView({ text: '/cmd ', cursor: 5 }, [afterFirst(true)], null);

    expect(view?.rows.map((row) => row.label)).toStrictEqual(['one', 'two']);
  });

  it('is asked of the bare provider even behind one that is not', () => {
    expect(startCompletion('/cmd ', 5, [afterFirst(false), afterFirst(true)])).toMatchObject({
      text: '/cmd one ',
    });
  });
});
