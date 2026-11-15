/**
 * Tests for the command-line history model: recording submitted lines
 * (blank and repeat-free, capped at HISTORY_LIMIT), the draft stored by the
 * first Up, walking back to the oldest and forward past the newest, and the
 * browsing reset a submit performs even when it records nothing.
 */
import { describe, expect, it } from 'vitest';

import {
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  type History,
  historyDown,
  historyUp,
  pushHistory,
} from './history';

/** A history holding {@link lines}, in order, as its entries. */
function filled(...lines: readonly string[]): History {
  return lines.reduce(pushHistory, EMPTY_HISTORY);
}

describe(pushHistory, () => {
  it('starts empty', () => {
    expect(EMPTY_HISTORY).toStrictEqual({ entries: [], index: null, draft: '' });
  });

  it('appends lines oldest first', () => {
    const history = pushHistory(pushHistory(EMPTY_HISTORY, 'one'), 'two');

    expect(history).toStrictEqual({ entries: ['one', 'two'], index: null, draft: '' });
  });

  it('skips blank lines', () => {
    expect(pushHistory(filled('one'), '').entries).toStrictEqual(['one']);
    expect(pushHistory(filled('one'), '   ').entries).toStrictEqual(['one']);
  });

  it('skips an exact repeat of the newest entry only', () => {
    const repeated = pushHistory(filled('one', 'two'), 'two');
    const again = pushHistory(filled('one', 'two', 'one'), 'one');
    const oldest = pushHistory(filled('one'), 'one');

    expect(repeated.entries).toStrictEqual(['one', 'two']);
    expect(again.entries).toStrictEqual(['one', 'two', 'one']);
    expect(oldest.entries).toStrictEqual(['one']);
  });

  it('keeps at most HISTORY_LIMIT entries, dropping the oldest', () => {
    const lines = Array.from({ length: HISTORY_LIMIT + 5 }, (_, n): string => `line ${String(n)}`);
    const history = filled(...lines);

    expect(history.entries).toStrictEqual(lines.slice(-HISTORY_LIMIT));
  });

  it('ends browsing, even when it records nothing', () => {
    const browsing = historyUp(filled('one'), 'typing')[0];
    const kept = pushHistory(browsing, 'two');
    const skipped = pushHistory(browsing, 'one');

    expect(kept).toStrictEqual({ entries: ['one', 'two'], index: null, draft: '' });
    expect(skipped).toStrictEqual({ entries: ['one'], index: null, draft: '' });
  });
});

describe(historyUp, () => {
  it('keeps the line as it is while nothing was ever submitted', () => {
    const [history, text] = historyUp(EMPTY_HISTORY, '/help');

    expect(history).toBe(EMPTY_HISTORY);
    expect(text).toBe('/help');
  });

  it('stores the draft on the first press and recalls the newest entry', () => {
    const [history, text] = historyUp(filled('one', 'two'), 'typed this');

    expect(history).toStrictEqual({ entries: ['one', 'two'], index: 1, draft: 'typed this' });
    expect(text).toBe('two');
  });

  it('walks one line older on every later press, keeping the draft', () => {
    const once = historyUp(filled('one', 'two', 'three'), 'draft');
    const twice = historyUp(once[0], 'three');
    const thrice = historyUp(twice[0], 'two');

    expect(once[1]).toBe('three');
    expect(twice).toStrictEqual([
      { entries: ['one', 'two', 'three'], index: 1, draft: 'draft' },
      'two',
    ]);
    expect(thrice).toStrictEqual([
      { entries: ['one', 'two', 'three'], index: 0, draft: 'draft' },
      'one',
    ]);
  });

  it('stays at the oldest entry', () => {
    const once = historyUp(filled('one'), 'd');
    const again = historyUp(once[0], 'one');

    expect(again).toStrictEqual([{ entries: ['one'], index: 0, draft: 'd' }, 'one']);
  });
});

describe(historyDown, () => {
  it('walks one line newer', () => {
    const once = historyUp(filled('one', 'two', 'three'), 'd');
    const twice = historyUp(once[0], 'two');

    expect(twice[1]).toBe('two');
    expect(historyDown(twice[0])).toStrictEqual([
      { entries: ['one', 'two', 'three'], index: 2, draft: 'd' },
      'three',
    ]);
  });

  it('past the newest entry returns to the draft and ends browsing', () => {
    const browsing = historyUp(filled('one', 'two'), 'd');

    expect(historyDown(browsing[0])).toStrictEqual([
      { entries: ['one', 'two'], index: null, draft: 'd' },
      'd',
    ]);
  });

  it('at the draft returns it and moves nothing', () => {
    const atDraft = filled('one');
    const [history, text] = historyDown(atDraft);
    const typed: History = { entries: [], index: null, draft: 'half a line' };

    expect(history).toBe(atDraft);
    expect(text).toBe('');
    expect(historyDown(typed)).toStrictEqual([typed, 'half a line']);
  });
});
