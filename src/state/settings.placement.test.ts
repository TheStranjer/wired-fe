/**
 * Tests for the placement settings (decision 13) in the stored settings
 * schema: `openIn` defaults to `here` and reads every placement back;
 * `openInByKind` defaults to none, reads a record of placements back, drops
 * kinds that do not exist or cannot have a placement, and refuses a
 * placement the type does not list.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { PLACEMENTS } from './placement';
import { SETTING_KEYS } from './settingKeys';
import { DEFAULT_SETTINGS, type Settings, SettingsSchema } from './settings';

/** Parse {@link input} with SettingsSchema, throwing through to the test on failure. */
function parse(input: unknown): Settings {
  return v.parse(SettingsSchema, input);
}

describe('the stored placement settings', () => {
  it('defaults where windows open to here, for every kind', () => {
    expect(parse({}).openIn).toBe('here');
    expect(parse({}).openInByKind).toStrictEqual({});
  });

  it('reads the default and the per-kind placements back', () => {
    for (const openIn of PLACEMENTS) {
      expect(parse({ openIn }).openIn).toBe(openIn);
    }

    expect(parse({ openInByKind: { thread: 'vsplit' } }).openInByKind).toStrictEqual({
      thread: 'vsplit',
    });
  });

  it('defaults where a reply composer opens to split, and reads every placement back', () => {
    expect(parse({}).replyIn).toBe('split');

    for (const replyIn of PLACEMENTS) {
      expect(parse({ replyIn }).replyIn).toBe(replyIn);
    }
  });

  it('lists the placements as the values of the replyIn knob', () => {
    const meta = SETTING_KEYS.find((entry) => entry.key === 'replyIn');

    expect(meta?.values).toStrictEqual(PLACEMENTS);
  });

  it('lists the placements as the values of the openIn knob', () => {
    const meta = SETTING_KEYS.find((entry) => entry.key === 'openIn');

    expect(meta?.values).toStrictEqual(PLACEMENTS);
  });

  it('keeps the per-kind placements out of the listing — /set openIn.<kind> owns them', () => {
    const keys = SETTING_KEYS.map((meta) => meta.key);

    expect(Object.hasOwn(DEFAULT_SETTINGS, 'openInByKind')).toBe(true);
    expect(keys).not.toContain('openInByKind');
  });

  it('drops a per-kind placement for a kind that does not exist or cannot have one', () => {
    const stored = { thread: 'float', toaster: 'split', status: 'hidden' };

    expect(parse({ openInByKind: stored }).openInByKind).toStrictEqual({ thread: 'float' });
  });

  it.each([
    ['a default placement it does not list', { openIn: 'sideways' }],
    ['a reply placement it does not list', { replyIn: 'sideways' }],
    ['a per-kind placement it does not list', { openInByKind: { thread: 'sideways' } }],
    ['per-kind placements that are not a record', { openInByKind: 'float' }],
  ])('refuses %s', (_name, input) => {
    expect(v.safeParse(SettingsSchema, input).success).toBe(false);
  });
});
