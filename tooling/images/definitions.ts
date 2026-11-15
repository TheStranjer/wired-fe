/**
 * The four default images of decision 9 as character grids and palettes:
 * green on black, matching the `wired` theme tokens in src/theme/tokens.css.
 * Wired builds its default avatar, banner, thumbnail and mascot URLs against
 * FRONTEND_BASE_URL (WBE-304), so these exact names are the contract; the
 * plugin in ./plugin.ts paints the grids into files at build time.
 */
import type { Palette } from './pixelArt.ts';

/** One generated image: its file name, grid, palette and pixel magnifier. */
export type DefaultImage = {
  readonly name: 'avi.png' | 'banner.png' | 'thumbnail.jpg' | 'mascot.png';
  readonly rows: readonly string[];
  readonly palette: Palette;
  readonly scale: number;
};

/** The theme as RGB: '.' black, '#' foreground green, 'o' dim green. */
const THEME: Palette = {
  '.': [0, 0, 0],
  '#': [51, 221, 102],
  o: [29, 122, 60],
};

/** WIRED in ten-row block letters; '.' is the background showing through. */
const LETTERS: Readonly<Record<string, readonly string[]>> = {
  W: [
    '#...#...#',
    '#...#...#',
    '#...#...#',
    '#..#.#..#',
    '#..#.#..#',
    '#.#...#.#',
    '#.#...#.#',
    '##.....##',
    '##.....##',
    '##.....##',
  ],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  R: [
    '#####.',
    '#....#',
    '#....#',
    '#....#',
    '#####.',
    '#.#...',
    '#..#..',
    '#..#..',
    '#...#.',
    '#....#',
  ],
  E: ['#####', '#....', '#....', '#....', '####.', '#....', '#....', '#....', '#....', '#####'],
  D: [
    '#####..',
    '#....#.',
    '#....#.',
    '#....#.',
    '#....#.',
    '#....#.',
    '#....#.',
    '#....#.',
    '#....#.',
    '#####..',
  ],
};

const WORD: readonly string[] = ['W', 'I', 'R', 'E', 'D'];
const LETTER_HEIGHT = 10;

/** One row of one letter's glyph; a missing row is a data mistake. */
function letterRow(letter: string, index: number): string {
  const row = LETTERS[letter]?.[index];
  if (row === undefined) {
    throw new Error(`letter ${letter} has no glyph row ${String(index)}`);
  }
  return row;
}

/** The word on `side` dots of margin, letters separated by `gap` dots. */
function writeWord(gap: string, side: number): readonly string[] {
  const pad = '.'.repeat(side);
  return Array.from({ length: LETTER_HEIGHT }, (_, index) => {
    const letters = WORD.map((letter) => letterRow(letter, index)).join(gap);
    return pad + letters + pad;
  });
}

const AVI_ROWS: readonly string[] = [
  '......######........',
  '....##########......',
  '...############.....',
  '..##############....',
  '..##############....',
  '...############.....',
  '....##########......',
  '......######........',
  '....................',
  '......######........',
  '....##########......',
  '..##############....',
  '####################',
  '####################',
  '####################',
  '####################',
  '####################',
  '####################',
  '####################',
  '####################',
];

/** A little terminal-cursor creature: antenna, block body, two feet. */
const MASCOT_ROWS: readonly string[] = [
  '.......##.......',
  '......####......',
  '.......##.......',
  '.......##.......',
  '..############..',
  '.##############.',
  '.##oo######oo##.',
  '.##oo######oo##.',
  '.##############.',
  '.####......####.',
  '.##############.',
  '..############..',
  '....##....##....',
  '....##....##....',
  '...####..####...',
  '................',
];

/** The banner: scanline rows, dim stripes running behind the word. */
function bannerRows(): readonly string[] {
  const word = writeWord('..', 11);
  return Array.from({ length: 20 }, (_, y) => {
    const bg = y % 2 === 1 ? 'o' : '.';
    const line = word[y - 5];
    return line === undefined ? bg.repeat(60) : line.replaceAll('.', bg);
  });
}

/** The thumbnail: the word alone, centred on black. */
function thumbnailRows(): readonly string[] {
  const blank = '.'.repeat(40);
  const rows = [blank, blank, blank, blank, blank];
  for (const line of writeWord('.', 3)) {
    rows.push(line);
  }
  return [...rows, blank, blank, blank, blank, blank, blank];
}

/** The four fixed files of decision 9, ready to be painted and encoded. */
export const DEFAULT_IMAGES: readonly DefaultImage[] = [
  { name: 'avi.png', rows: AVI_ROWS, palette: THEME, scale: 20 },
  { name: 'banner.png', rows: bannerRows(), palette: THEME, scale: 25 },
  { name: 'thumbnail.jpg', rows: thumbnailRows(), palette: THEME, scale: 30 },
  { name: 'mascot.png', rows: MASCOT_ROWS, palette: THEME, scale: 16 },
];
