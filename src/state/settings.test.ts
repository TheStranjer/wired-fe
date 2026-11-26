/**
 * Tests for settings: the one default record a session starts from, the
 * SettingsSchema that reads them back from storage (every field optional, every
 * default filled in, junk refused so the reader of storage can fall back) and
 * the SETTING_KEYS metadata /set lists and checks itself against: every visible
 * knob the type names, exactly once, with its values and description, and the
 * hidden ones among none of them.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { SETTING_KEYS } from './settingKeys';
import {
  CLOCK_FORMATS,
  DEFAULT_SETTINGS,
  SettingsSchema,
  type Settings,
  THEMES,
  VISIBILITIES,
} from './settings';
import type { KeyOverride } from '../lib/keyOverride';

/** One bound and one unbound override. */
const OVERRIDES: readonly KeyOverride[] = [
  { mode: 'insert', chord: 'Ctrl+e', line: '/compose' },
  { mode: 'navigation', chord: 'f', line: null },
];

/** A session that has turned every knob. */
const CHOSEN: Settings = {
  avatars: false,
  clockFormat: '12h',
  defaultVisibility: 'local',
  density: 'lines',
  effects: true,
  expandMedia: true,
  feeds: [{ id: 'f1', name: 'main', sources: [{ accountKey: 'a#1', source: 'tag:rust' }] }],
  images: false,
  keyOverrides: OVERRIDES,
  language: 'de',
  openIn: 'float',
  openInByKind: { thread: 'vsplit', dm: 'hidden' },
  postAs: 'a#1',
  replyIn: 'hidden',
  streamMade: true,
  theme: 'lain',
};

/** Parse {@link input} with SettingsSchema. */
function parse(input: unknown): Settings {
  return v.parse(SettingsSchema, input);
}

describe('the settings a session starts from', () => {
  it('starts a session quiet, plain and public', () => {
    expect(DEFAULT_SETTINGS).toStrictEqual({
      avatars: true,
      clockFormat: '24h',
      defaultVisibility: 'public',
      density: 'cards',
      effects: false,
      expandMedia: false,
      feeds: [],
      images: true,
      keyOverrides: [],
      language: null,
      openIn: 'here',
      openInByKind: {},
      postAs: null,
      replyIn: 'split',
      streamMade: false,
      theme: 'wired',
    });
  });

  it('defaults every knob the type names, and no others', () => {
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toStrictEqual([
      'avatars',
      'clockFormat',
      'defaultVisibility',
      'density',
      'effects',
      'expandMedia',
      'feeds',
      'images',
      'keyOverrides',
      'language',
      'openIn',
      'openInByKind',
      'postAs',
      'replyIn',
      'streamMade',
      'theme',
    ]);
  });

  it('accepts a record that turns every knob', () => {
    expect(CHOSEN).not.toStrictEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.effects).toBe(false);
  });
});

describe('the stored settings schema', () => {
  it('fills every default for an empty record', () => {
    expect(parse({})).toStrictEqual(DEFAULT_SETTINGS);
  });

  it('keeps what is stored and defaults what is missing', () => {
    expect(parse({ effects: true })).toStrictEqual({ ...DEFAULT_SETTINGS, effects: true });
  });

  it('reads a whole valid record back unchanged', () => {
    expect(parse(CHOSEN)).toStrictEqual(CHOSEN);
  });

  it('drops keys the settings do not have', () => {
    expect(parse({ ...DEFAULT_SETTINGS, volume: 11 })).toStrictEqual(DEFAULT_SETTINGS);
  });

  it('defaults the theme to wired and reads a chosen one back', () => {
    expect(parse({}).theme).toBe('wired');

    for (const theme of THEMES) {
      expect(parse({ theme }).theme).toBe(theme);
    }
  });

  it('reads the reader’s own key overrides back, bound and unbound', () => {
    expect(parse({ keyOverrides: OVERRIDES }).keyOverrides).toStrictEqual(OVERRIDES);
  });

  it('reads the saved feeds back, and defaults them to none', () => {
    expect(parse({ feeds: CHOSEN.feeds }).feeds).toStrictEqual(CHOSEN.feeds);
    expect(parse({}).feeds).toStrictEqual([]);
    expect(
      v.safeParse(SettingsSchema, { feeds: [{ id: 'f', name: '', sources: [] }] }).success,
    ).toBe(false);
  });

  it('reads whether the stream feed was made, and defaults it to not yet', () => {
    expect(parse({ streamMade: true }).streamMade).toBe(true);
    expect(parse({}).streamMade).toBe(false);
  });

  it('defaults the overrides to none', () => {
    expect(parse({}).keyOverrides).toStrictEqual([]);
  });

  it.each([
    ['a bad enum word', { clockFormat: '25h' }],
    ['another bad enum word', { defaultVisibility: 'everyone' }],
    ['a theme it does not list', { theme: 'blue' }],
    ['a boolean that is a word', { effects: 'yes' }],
    [
      'an override naming neither mode',
      { keyOverrides: [{ mode: 'both', chord: 'x', line: null }] },
    ],
    [
      'an override whose line is a number',
      { keyOverrides: [{ mode: 'insert', chord: 'x', line: 3 }] },
    ],
    ['overrides that are not a list', { keyOverrides: 'Ctrl+e' }],
    ['junk altogether', 'not a record'],
    ['nothing at all', null],
    ['a number', 42],
  ])('refuses %s', (_name, input) => {
    expect(v.safeParse(SettingsSchema, input).success).toBe(false);
  });

  it('accepts every clock format and every visibility it lists', () => {
    for (const clockFormat of CLOCK_FORMATS) {
      expect(parse({ clockFormat }).clockFormat).toBe(clockFormat);
    }
    for (const defaultVisibility of VISIBILITIES) {
      expect(parse({ defaultVisibility }).defaultVisibility).toBe(defaultVisibility);
    }
  });
});

describe('the setting metadata /set reads', () => {
  it('names every listed knob of the type exactly once, in a stable order', () => {
    const keys = SETTING_KEYS.map((meta) => meta.key);
    const listed: (keyof Settings)[] = [
      'avatars',
      'clockFormat',
      'defaultVisibility',
      'density',
      'effects',
      'expandMedia',
      'images',
      'openIn',
      'replyIn',
      'theme',
    ];

    expect([...keys].sort()).toStrictEqual(listed.sort());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps the key overrides out of the listing — /bind owns them', () => {
    const keys = SETTING_KEYS.map((meta) => meta.key);

    expect(Object.hasOwn(DEFAULT_SETTINGS, 'keyOverrides')).toBe(true);
    expect(keys).not.toContain('keyOverrides');
    expect(Object.hasOwn(DEFAULT_SETTINGS, 'feeds')).toBe(true);
    expect(keys).not.toContain('feeds');
  });

  it('keeps the stream flag out of the listing too', () => {
    const keys = SETTING_KEYS.map((meta) => meta.key);

    expect(Object.hasOwn(DEFAULT_SETTINGS, 'streamMade')).toBe(true);
    expect(keys).not.toContain('streamMade');
  });

  it('gives the six enum knobs their values', () => {
    const enums = SETTING_KEYS.filter((meta) => meta.kind === 'enum');
    const keys = enums.map((meta) => meta.key);

    expect(keys).toStrictEqual([
      'clockFormat',
      'defaultVisibility',
      'density',
      'openIn',
      'replyIn',
      'theme',
    ]);

    for (const meta of enums) {
      expect(meta.values?.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it('gives the four boolean knobs no values and a description', () => {
    const booleans = SETTING_KEYS.filter((meta) => meta.kind === 'boolean');
    const keys = booleans.map((meta) => meta.key);

    expect(keys).toStrictEqual(['avatars', 'effects', 'expandMedia', 'images']);

    for (const meta of booleans) {
      expect(meta.values).toBeUndefined();
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it('lists exactly the values the schema accepts', () => {
    const byKey = new Map(SETTING_KEYS.map((meta) => [meta.key, meta.values]));

    expect(byKey.get('clockFormat')).toStrictEqual(CLOCK_FORMATS);
    expect(byKey.get('defaultVisibility')).toStrictEqual(VISIBILITIES);
    expect(byKey.get('effects')).toBeUndefined();
    expect(byKey.get('expandMedia')).toBeUndefined();
    expect(byKey.get('theme')).toStrictEqual(THEMES);
  });
});
