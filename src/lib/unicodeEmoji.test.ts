/**
 * Tests for the Unicode emoji adapter: it maps the emojibase compact entries,
 * drops what belongs to no group, groups the rest in the picker's order and
 * filters by name, keyword and character.
 */
import { describe, expect, it } from 'vitest';

import { adaptEmojis, filterEmojis, groupEmojis, matchesTerms, searchTerms } from './unicodeEmoji';

/** Entries as emojibase's compact English list writes them. */
const RAW: readonly unknown[] = [
  { hexcode: '1F1E6', label: 'regional indicator A', order: 1, unicode: '🇦' },
  { group: 0, hexcode: '1F600', label: 'grinning face', tags: ['happy', 'smile'], unicode: '😀' },
  { group: 7, hexcode: '1F525', label: 'fire', tags: ['flame', 'hot'], unicode: '🔥' },
  {
    group: 1,
    label: 'thumbs up',
    tags: ['+1'],
    unicode: '👍',
    skins: [{ group: 1, label: 'thumbs up: light skin tone', unicode: '👍🏻' }],
  },
  { group: 2, label: 'light skin tone', unicode: '🏻' },
  { group: 9, label: 'flag: Japan', unicode: '🇯🇵' },
  { group: 4, label: 'pizza', unicode: '🍕' },
  { group: 4, unicode: '🍔' },
  { group: 4, label: 'no glyph' },
  'junk',
];

describe(adaptEmojis, () => {
  it('maps an entry onto its character, name, group and keywords', () => {
    expect(adaptEmojis(RAW).find((emoji) => emoji.emoji === '🔥')).toStrictEqual({
      emoji: '🔥',
      name: 'fire',
      group: 'objects',
      keywords: ['flame', 'hot'],
    });
  });

  it('leaves out skin-tone components, groupless entries and malformed ones', () => {
    expect(adaptEmojis(RAW).map((emoji) => emoji.name)).toStrictEqual([
      'grinning face',
      'fire',
      'thumbs up',
      'flag: Japan',
      'pizza',
    ]);
  });

  it('gives an entry without tags no keywords', () => {
    expect(adaptEmojis(RAW).find((emoji) => emoji.name === 'pizza')?.keywords).toStrictEqual([]);
  });

  it('adapts anything but a list to nothing', () => {
    expect(adaptEmojis({ not: 'a list' })).toStrictEqual([]);
  });
});

describe(groupEmojis, () => {
  it('groups in the picker order and omits empty groups', () => {
    const groups = groupEmojis(adaptEmojis(RAW));

    expect(groups.map((group) => group.key)).toStrictEqual([
      'smileys',
      'people',
      'food',
      'objects',
      'flags',
    ]);
    expect(groups[0]?.title).toBe('smileys & emotion');
    expect(groups[3]?.emojis.map((emoji) => emoji.emoji)).toStrictEqual(['🔥']);
  });
});

describe('searching', () => {
  it('splits a query into lower-case words, colons and blanks dropped', () => {
    expect(searchTerms('  :Blob: Cat ')).toStrictEqual(['blob', 'cat']);
  });

  it('matches when every word is part of some word, and an empty query matches all', () => {
    expect(matchesTerms(['fl', 'ho'], ['fire', 'Flame', 'hot'])).toBe(true);
    expect(matchesTerms(['cold'], ['fire', 'hot'])).toBe(false);
    expect(matchesTerms([], ['fire'])).toBe(true);
  });

  it('filters by name, by keyword and by character', () => {
    const all = adaptEmojis(RAW);

    expect(filterEmojis(all, 'fire').map((emoji) => emoji.name)).toStrictEqual(['fire']);
    expect(filterEmojis(all, 'happy').map((emoji) => emoji.name)).toStrictEqual(['grinning face']);
    expect(filterEmojis(all, '🍕').map((emoji) => emoji.name)).toStrictEqual(['pizza']);
    expect(filterEmojis(all, '')).toHaveLength(all.length);
  });
});
