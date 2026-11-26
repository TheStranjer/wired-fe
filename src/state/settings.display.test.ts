/**
 * Tests for the display knobs `density`, `avatars` and `images` (WFE-192,
 * decision 15): cards, avatars and inline images by default, the DENSITIES
 * list, and the stored-settings schema filling them in for settings saved
 * before they existed, keeping a chosen value and refusing a bad one.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { SETTING_KEYS } from './settingKeys';
import { DEFAULT_SETTINGS, DENSITIES, SettingsSchema, type Settings } from './settings';

/** Parse {@link input} with SettingsSchema, throwing through to the test on failure. */
function parse(input: unknown): Settings {
  return v.parse(SettingsSchema, input);
}

describe('the display knobs', () => {
  it('default to cards, with avatars and images shown', () => {
    expect(DEFAULT_SETTINGS.density).toBe('cards');
    expect(DEFAULT_SETTINGS.avatars).toBe(true);
    expect(DEFAULT_SETTINGS.images).toBe(true);
  });

  it('list the densities, the default first', () => {
    expect(DENSITIES).toStrictEqual(['cards', 'lines']);
  });

  it('are filled in when reading settings stored without them', () => {
    const old = { clockFormat: '12h', effects: true, theme: 'lain' };

    expect(parse(old)).toStrictEqual({ ...DEFAULT_SETTINGS, ...old });
  });

  it('read back as chosen', () => {
    for (const density of DENSITIES) {
      expect(parse({ density }).density).toBe(density);
    }

    expect(parse({ avatars: false }).avatars).toBe(false);
    expect(parse({ images: false }).images).toBe(false);
    expect(parse({ avatars: true, images: true })).toStrictEqual(DEFAULT_SETTINGS);
  });

  it('lists the densities as the density knob’s values', () => {
    const meta = SETTING_KEYS.find((entry) => entry.key === 'density');

    expect(meta?.values).toStrictEqual(DENSITIES);
  });

  it.each([
    ['a density it does not list', { density: 'compact' }],
    ['a density that is a boolean', { density: true }],
    ['avatars that are a word', { avatars: 'off' }],
    ['images that are a number', { images: 0 }],
  ])('refuses %s', (_name, input) => {
    expect(v.safeParse(SettingsSchema, input).success).toBe(false);
  });
});
