/**
 * Tests for settings: the one default record a session starts from, and that it
 * answers for every knob the type names — a new knob has to be defaulted here.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, type Settings } from './settings';

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
    const chosen: Settings = {
      clockFormat: '12h',
      defaultVisibility: 'local',
      effects: true,
      expandMedia: true,
    };

    expect(chosen).not.toStrictEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.effects).toBe(false);
  });
});
