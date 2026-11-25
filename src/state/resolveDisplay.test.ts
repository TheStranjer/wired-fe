/**
 * Table test for the display resolver (decision 15): every key comes from the
 * window's override when it has one, and from the reader's setting otherwise.
 */
import { describe, expect, it } from 'vitest';

import { type ResolvedDisplay, resolveDisplay } from './resolveDisplay';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import type { DisplayOverrides } from '../windows/model';

const LINES_OFF: Settings = {
  ...DEFAULT_SETTINGS,
  density: 'lines',
  avatars: false,
  images: false,
};

/** One row: what the reader chose, what the window overrides, what is in force. */
type Row = {
  readonly name: string;
  readonly settings: Settings;
  readonly overrides: DisplayOverrides;
  readonly expected: ResolvedDisplay;
};

const ROWS: readonly Row[] = [
  {
    name: 'no overrides, default settings',
    settings: DEFAULT_SETTINGS,
    overrides: {},
    expected: { density: 'cards', avatars: true, images: true },
  },
  {
    name: 'no overrides, changed settings',
    settings: LINES_OFF,
    overrides: {},
    expected: { density: 'lines', avatars: false, images: false },
  },
  {
    name: 'density only',
    settings: DEFAULT_SETTINGS,
    overrides: { density: 'lines' },
    expected: { density: 'lines', avatars: true, images: true },
  },
  {
    name: 'avatars only',
    settings: DEFAULT_SETTINGS,
    overrides: { avatars: false },
    expected: { density: 'cards', avatars: false, images: true },
  },
  {
    name: 'images only',
    settings: DEFAULT_SETTINGS,
    overrides: { images: false },
    expected: { density: 'cards', avatars: true, images: false },
  },
  {
    name: 'a false override beats a true setting',
    settings: DEFAULT_SETTINGS,
    overrides: { avatars: false, images: false },
    expected: { density: 'cards', avatars: false, images: false },
  },
  {
    name: 'a true override beats a false setting',
    settings: LINES_OFF,
    overrides: { avatars: true, images: true },
    expected: { density: 'lines', avatars: true, images: true },
  },
  {
    name: 'every key overridden',
    settings: LINES_OFF,
    overrides: { density: 'cards', avatars: true, images: true },
    expected: { density: 'cards', avatars: true, images: true },
  },
];

describe(resolveDisplay, () => {
  it.each(ROWS)('$name', ({ settings, overrides, expected }) => {
    expect(resolveDisplay(settings, overrides)).toStrictEqual(expected);
  });
});
