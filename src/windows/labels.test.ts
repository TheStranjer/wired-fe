/**
 * Post labels: the arrival-order numbering produced by labelForIndex and the
 * per-window LabelBook that hands ids their labels and keeps them stable.
 */
import { describe, expect, it } from 'vitest';

import { assignLabel, EMPTY_LABEL_BOOK, idForLabel, labelForId, labelForIndex } from './labels';

describe(labelForIndex, () => {
  it('labels the first ten posts a0 to a9', () => {
    expect(labelForIndex(0)).toBe('a0');
    expect(labelForIndex(9)).toBe('a9');
  });

  it('advances the letter every ten posts', () => {
    expect(labelForIndex(10)).toBe('b0');
    expect(labelForIndex(259)).toBe('z9');
  });

  it('starts two letters at 260, letter-major', () => {
    expect(labelForIndex(260)).toBe('aa0');
    expect(labelForIndex(269)).toBe('aa9');
    expect(labelForIndex(270)).toBe('ab0');
  });

  it('counts two letters from az9 on to zz9', () => {
    expect(labelForIndex(519)).toBe('az9');
    expect(labelForIndex(520)).toBe('ba0');
    expect(labelForIndex(7019)).toBe('zz9');
  });

  it('starts three letters at 7020', () => {
    expect(labelForIndex(7020)).toBe('aaa0');
  });

  it('throws on a negative or fractional index', () => {
    expect(() => labelForIndex(-1)).toThrow(RangeError);
    expect(() => labelForIndex(1.5)).toThrow(RangeError);
  });
});

describe(assignLabel, () => {
  it('gives the first id a0 and the next a1', () => {
    const [first, firstLabel] = assignLabel(EMPTY_LABEL_BOOK, 'post-1');
    const [second, secondLabel] = assignLabel(first, 'post-2');

    expect(firstLabel).toBe('a0');
    expect(secondLabel).toBe('a1');
    expect(second.next).toBe(2);
  });

  it('hands back the same book and label for an id that has one', () => {
    const [first] = assignLabel(EMPTY_LABEL_BOOK, 'post-1');
    const [again, label] = assignLabel(first, 'post-1');

    expect(again).toBe(first);
    expect(label).toBe('a0');
  });

  it('labels a third post a2 without disturbing the first two', () => {
    const [first] = assignLabel(EMPTY_LABEL_BOOK, 'post-1');
    const [second] = assignLabel(first, 'post-2');
    const [third, thirdLabel] = assignLabel(second, 'post-3');

    expect(thirdLabel).toBe('a2');
    expect(labelForId(third, 'post-1')).toBe('a0');
    expect(labelForId(third, 'post-2')).toBe('a1');
  });

  it('copies both maps instead of mutating the book it was given', () => {
    const [first] = assignLabel(EMPTY_LABEL_BOOK, 'post-1');
    const [second] = assignLabel(first, 'post-2');

    expect(first.byId).not.toBe(second.byId);
    expect(first.byLabel).not.toBe(second.byLabel);
    expect(first.next).toBe(1);
    expect(labelForId(first, 'post-2')).toBeUndefined();
  });

  it('never writes into the empty book', () => {
    const [, label] = assignLabel(EMPTY_LABEL_BOOK, 'post-1');

    expect(label).toBe('a0');
    expect(EMPTY_LABEL_BOOK.next).toBe(0);
    expect(idForLabel(EMPTY_LABEL_BOOK, 'a0')).toBeUndefined();
  });
});

describe(idForLabel, () => {
  it('finds the id whatever case the label is given in', () => {
    const [book] = assignLabel(EMPTY_LABEL_BOOK, 'post-1');

    expect(idForLabel(book, 'A0')).toBe('post-1');
    expect(idForLabel(book, 'a0')).toBe('post-1');
  });

  it('knows no id for an unassigned label', () => {
    expect(idForLabel(EMPTY_LABEL_BOOK, 'a0')).toBeUndefined();
    expect(idForLabel(EMPTY_LABEL_BOOK, 'zz9')).toBeUndefined();
  });
});

describe(labelForId, () => {
  it('returns the label an id holds and nothing for one that does not', () => {
    const [first] = assignLabel(EMPTY_LABEL_BOOK, 'post-1');
    const [second] = assignLabel(first, 'post-2');

    expect(labelForId(second, 'post-1')).toBe('a0');
    expect(labelForId(second, 'post-99')).toBeUndefined();
  });
});
