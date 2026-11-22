import { describe, expect, it } from 'vitest';

import { splitFirstWord } from './words';

describe(splitFirstWord, () => {
  it('returns the whole text and an empty rest when there is no gap', () => {
    expect(splitFirstWord('hello')).toStrictEqual(['hello', '']);
  });

  it('returns two empty strings for blank input', () => {
    expect(splitFirstWord('   ')).toStrictEqual(['', '']);
  });

  it('ignores leading and trailing spaces', () => {
    expect(splitFirstWord('   a3   some text  ')).toStrictEqual(['a3', 'some text']);
  });

  it('splits at a tab', () => {
    expect(splitFirstWord('a3\tsome\ttext')).toStrictEqual(['a3', 'some\ttext']);
  });
});
