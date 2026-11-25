/**
 * Tests for what the emoji picker shows: the post's reactions, the custom
 * emoji by category with the uncategorised last, the Unicode emoji by group or
 * a loading note, the search over all of them, the one run of grid indexes and
 * where the arrow keys move.
 */
import { describe, expect, it } from 'vitest';

import { COLUMNS, gridTarget, pickerSections } from './emojiPickerModel';
import type { PickerData, Section } from './emojiPickerModel';
import type { PostReaction } from './ReactionChip';

const REACTIONS: readonly PostReaction[] = [
  { name: '🔥', count: 2, me: true, url: null },
  { name: 'blob@far.example', count: 1, me: false, url: 'https://far.example/blob.png' },
];

const DATA: PickerData = {
  custom: [
    { shortcode: 'plain', url: 'https://m.example/plain.png', category: null },
    { shortcode: 'blobcat', url: 'https://m.example/blobcat.png', category: 'Blobs' },
    { shortcode: 'party', url: 'https://m.example/party.png', category: 'Fun' },
    { shortcode: 'blobby', url: 'http://m.example/blobby.png', category: 'Blobs' },
  ],
  unicode: [
    { emoji: '😀', name: 'grinning face', group: 'smileys', keywords: ['happy'] },
    { emoji: '🔥', name: 'fire', group: 'objects', keywords: ['flame'] },
  ],
};

/** The picker's sections for {@link query} over the fixtures. */
function sections(query = '', data: PickerData = DATA): readonly Section[] {
  return pickerSections({ ...data, reactions: REACTIONS }, query);
}

/** The titles of the sections, in order. */
function titles(query = ''): readonly string[] {
  return sections(query).map((section) => section.title);
}

describe(pickerSections, () => {
  it('orders the post, the custom emoji by category (none last) and the Unicode groups', () => {
    expect(titles()).toStrictEqual([
      'on this post',
      'custom: Blobs',
      'custom: Fun',
      'custom',
      'emoji: smileys & emotion',
      'emoji: objects',
    ]);
  });

  it('names a reaction by its character or its shortcode and marks the viewer’s own', () => {
    const [post] = sections();

    expect(
      post?.cells.map((cell) => [cell.name, cell.choose, cell.remove, cell.pressed]),
    ).toStrictEqual([
      ['🔥', '🔥', true, true],
      [':blob:', ':blob:', false, false],
    ]);
    expect(post?.cells[1]?.image).toBe('https://far.example/blob.png');
  });

  it('draws a custom emoji as its still picture when that is https, else as its name', () => {
    const blobs = sections().find((section) => section.id === 'custom:Blobs');

    expect(blobs?.cells.map((cell) => [cell.name, cell.image, cell.glyph])).toStrictEqual([
      [':blobcat:', 'https://m.example/blobcat.png', ':blobcat:'],
      [':blobby:', null, ':blobby:'],
    ]);
    expect(blobs?.cells[0]).toMatchObject({ choose: ':blobcat:', remove: false });
  });

  it('names a Unicode emoji by its Unicode name and sends the character', () => {
    const fire = sections().at(-1)?.cells[0];

    expect(fire).toMatchObject({ name: 'fire', choose: '🔥', glyph: '🔥', image: null });
  });

  it('numbers the cells of all sections in one run', () => {
    expect(sections().map((section) => [section.start, section.cells.length])).toStrictEqual([
      [0, 2],
      [2, 2],
      [4, 1],
      [5, 1],
      [6, 1],
      [7, 1],
    ]);
  });

  it('narrows every section by name, shortcode, category or keyword', () => {
    expect(titles('fire')).toStrictEqual(['on this post', 'emoji: objects']);
    expect(titles('blob')).toStrictEqual(['on this post', 'custom: Blobs']);
    expect(titles('happy')).toStrictEqual(['emoji: smileys & emotion']);
    expect(titles(':fun:')).toStrictEqual(['custom: Fun']);
  });

  it('shows no sections for a query that finds nothing', () => {
    expect(titles('nothing like this')).toStrictEqual([]);
  });

  it('shows a loading note in the emoji section until the Unicode emoji arrive', () => {
    const loading = sections('', { custom: [], unicode: null });

    expect(
      loading.map((section) => [section.title, section.note, section.cells.length]),
    ).toStrictEqual([
      ['on this post', null, 2],
      ['emoji', 'loading…', 0],
    ]);
    expect(sections('', DATA).every((section) => section.note === null)).toBe(true);
  });
});

describe(gridTarget, () => {
  it.each([
    ['ArrowRight', 3, 4],
    ['ArrowRight', 19, 19],
    ['ArrowLeft', 3, 2],
    ['ArrowLeft', 0, 0],
    ['ArrowDown', 3, 3 + COLUMNS],
    ['ArrowDown', 15, 19],
    ['ArrowUp', 12, 12 - COLUMNS],
  ])('moves on %s from %i to %i, stopping at the ends', (key, from, to) => {
    expect(gridTarget(key, from, 20)).toBe(to);
  });

  it('leaves the grid for the search field above the first row', () => {
    expect(gridTarget('ArrowUp', COLUMNS - 1, 20)).toBe(-1);
  });

  it('jumps to the first and last cell with Home and End', () => {
    expect(gridTarget('Home', 9, 20)).toBe(0);
    expect(gridTarget('End', 9, 20)).toBe(19);
  });

  it('leaves every other key alone', () => {
    expect(gridTarget('a', 9, 20)).toBeNull();
  });
});
