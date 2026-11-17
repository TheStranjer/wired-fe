/**
 * Tests for settings: the one default record a session starts from, the
 * SettingsSchema that reads them back from storage — every field optional on
 * input, every default filled in, junk refused so the reader of storage can
 * fall back — and the SETTING_KEYS metadata /set lists and checks itself
 * against: every knob the type names, exactly once, with the values and the
 * description it prints. A new knob has to be defaulted, schema'd and keyed here.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  CLOCK_FORMATS,
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  SettingsSchema,
  type Settings,
  VISIBILITIES,
} from './settings';

/** A session that has turned every knob. */
const CHOSEN: Settings = {
  clockFormat: '12h',
  defaultVisibility: 'local',
  effects: true,
  expandMedia: true,
};

/** Parse {@link input} with SettingsSchema, throwing through to the test on failure. */
function parse(input: unknown): Settings {
  return v.parse(SettingsSchema, input);
}

describe('the settings a session starts from', () => {
  it('starts a session quiet, plain and public', () => {
    expect(DEFAULT_SETTINGS).toStrictEqual({
      clockFormat: '24h',
      defaultVisibility: 'public',
      effects: false,
      expandMedia: false,
    });
  });

  it('defaults every knob the type names, and no others', () => {
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toStrictEqual([
      'clockFormat',
      'defaultVisibility',
      'effects',
      'expandMedia',
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
    expect(parse({ ...DEFAULT_SETTINGS, theme: 'blue' })).toStrictEqual(DEFAULT_SETTINGS);
  });

  it.each([
    ['a bad enum word', { clockFormat: '25h' }],
    ['another bad enum word', { defaultVisibility: 'everyone' }],
    ['a boolean that is a word', { effects: 'yes' }],
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
  it('names every knob of the type exactly once, in a stable order', () => {
    const keys = SETTING_KEYS.map((meta) => meta.key);

    expect([...keys].sort()).toStrictEqual(Object.keys(DEFAULT_SETTINGS).sort());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives the two enum knobs their values', () => {
    const enums = SETTING_KEYS.filter((meta) => meta.kind === 'enum');
    const keys = enums.map((meta) => meta.key);

    expect(keys).toStrictEqual(['clockFormat', 'defaultVisibility']);

    for (const meta of enums) {
      expect(meta.values?.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it('gives the two boolean knobs no values and a description', () => {
    const booleans = SETTING_KEYS.filter((meta) => meta.kind === 'boolean');
    const keys = booleans.map((meta) => meta.key);

    expect(keys).toStrictEqual(['effects', 'expandMedia']);

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
  });
});
