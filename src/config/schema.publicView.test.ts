/**
 * Tests for the `publicView` build setting (decision 3): every accepted value
 * per instances mode and every refusal, with its message.
 */
import { describe, expect, it } from 'vitest';

import { type WiredConfig, parseWiredConfig } from './schema';

const WIRED = 'https://wired.example';
const OTHER = 'https://other.example';

/** Parses input that must be valid and returns the configuration. */
function parsed(input: unknown): WiredConfig {
  const result = parseWiredConfig(input);
  if (!result.ok) {
    throw new Error(`expected ok, got: ${result.error.join('; ')}`);
  }

  return result.value;
}

/** Parses input that must be invalid and returns the issue messages. */
function messages(input: unknown): readonly string[] {
  const result = parseWiredConfig(input);
  if (result.ok) {
    throw new Error(`expected err, got: ${JSON.stringify(result.value)}`);
  }

  return result.error;
}

/** The instances block of each mode, listing {@link WIRED} and {@link OTHER}. */
const MODES: readonly (readonly [string, unknown])[] = [
  ['same-origin', { mode: 'same-origin' }],
  ['fixed', { mode: 'fixed', origin: WIRED }],
  ['list', { mode: 'list', origins: [WIRED, OTHER] }],
  ['open', { mode: 'open' }],
];

/** A config with {@link instances} and, unless undefined, {@link publicView}. */
function config(instances: unknown, publicView?: unknown): unknown {
  return publicView === undefined
    ? { appName: 'WiredFE', instances }
    : { appName: 'WiredFE', instances, publicView };
}

describe('publicView', () => {
  it.each(MODES)(
    'leaves publicView out of a %s config that does not set it',
    (_mode, instances) => {
      expect(parsed(config(instances))).not.toHaveProperty('publicView');
    },
  );

  it.each(MODES)('accepts false and null with %s', (_mode, instances) => {
    expect(parsed(config(instances, false)).publicView).toBe(false);
    expect(parsed(config(instances, null)).publicView).toBeNull();
  });

  it.each(MODES.filter(([mode]) => mode !== 'open'))('accepts true with %s', (_mode, instances) => {
    expect(parsed(config(instances, true)).publicView).toBe(true);
  });

  it('accepts an object that names the fixed origin, with each value kind', () => {
    const instances = { mode: 'fixed', origin: WIRED };

    expect(parsed(config(instances, { [WIRED]: true })).publicView).toStrictEqual({
      [WIRED]: true,
    });
    expect(parsed(config(instances, { [WIRED]: false })).publicView).toStrictEqual({
      [WIRED]: false,
    });
    expect(parsed(config(instances, { [WIRED]: null })).publicView).toStrictEqual({
      [WIRED]: null,
    });
    expect(parsed(config(instances, {})).publicView).toStrictEqual({});
  });

  it('accepts an object over listed origins, naming all, some or none of them', () => {
    const instances = { mode: 'list', origins: [WIRED, OTHER] };
    const both = { [WIRED]: true, [OTHER]: null };

    expect(parsed(config(instances, both)).publicView).toStrictEqual(both);
    expect(parsed(config(instances, { [OTHER]: false })).publicView).toStrictEqual({
      [OTHER]: false,
    });
    expect(parsed(config(instances, {})).publicView).toStrictEqual({});
  });

  it('accepts an http localhost key like any other origin', () => {
    const origin = 'http://localhost:3000';
    const instances = { mode: 'list', origins: [origin] };

    expect(parsed(config(instances, { [origin]: true })).publicView).toStrictEqual({
      [origin]: true,
    });
  });

  it('refuses the object form on same-origin', () => {
    expect(messages(config({ mode: 'same-origin' }, { [WIRED]: true }))).toStrictEqual([
      'publicView: the object form needs origins known at build time; use true, false or null',
    ]);
  });

  it('refuses a fixed object that names another origin', () => {
    expect(messages(config({ mode: 'fixed', origin: WIRED }, { [OTHER]: true }))).toStrictEqual([
      `publicView: may only name instances.origin ${WIRED}`,
    ]);
    expect(
      messages(config({ mode: 'fixed', origin: WIRED }, { [WIRED]: true, [OTHER]: true })),
    ).toStrictEqual([`publicView: may only name instances.origin ${WIRED}`]);
  });

  it('refuses a list object that names an origin outside instances.origins', () => {
    const instances = { mode: 'list', origins: [WIRED], allowCustom: true };

    expect(messages(config(instances, { [WIRED]: true, [OTHER]: false }))).toStrictEqual([
      `publicView: names origins missing from instances.origins: ${OTHER}`,
    ]);
  });

  it('refuses true and the object form on open', () => {
    expect(messages(config({ mode: 'open' }, true))).toStrictEqual([
      'publicView: true is not allowed with instances.mode "open"',
    ]);
    expect(messages(config({ mode: 'open' }, { [WIRED]: true }))).toStrictEqual([
      'publicView: the object form is not allowed with instances.mode "open"',
    ]);
  });

  it('refuses a key that is not an origin, naming it', () => {
    const instances = { mode: 'list', origins: [WIRED] };

    expect(messages(config(instances, { 'wired.example': true }))).toContain(
      'publicView: key "wired.example" must be an https:// origin, or http:// for localhost',
    );
  });

  it('refuses a value that is neither a boolean, null nor an object of those', () => {
    const instances = { mode: 'fixed', origin: WIRED };

    expect(messages(config(instances, 'yes')).some((m) => m.startsWith('publicView: '))).toBe(true);
    expect(
      messages(config(instances, { [WIRED]: 'yes' })).some((m) => m.startsWith('publicView: ')),
    ).toBe(true);
  });
});
