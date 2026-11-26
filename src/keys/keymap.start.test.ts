/**
 * The shipped `/start` keys (WFE-299, decisions 6 and 18): `Ctrl+B Space` in
 * both modes and `w Space` in navigation mode run `/start`; the keymap builds
 * with no problems.
 */
import { describe, expect, it } from 'vitest';

import { buildKeymap } from './keymap';
import type { Keymap } from '../commands/bindingTypes';
import { loadDefinitions } from '../commands/definitions';
import { buildRegistry } from '../commands/registry';

/** The keymap the shipped defs folder produces, throwing when it fails. */
function shippedKeymap(): Keymap {
  const definitions = loadDefinitions();
  if (!definitions.ok) {
    throw new Error(`loadDefinitions rejected the defs folder: ${definitions.error}`);
  }
  const registry = buildRegistry(definitions.value);
  if (!registry.ok) {
    throw new Error(`buildRegistry rejected the definitions: ${registry.error}`);
  }
  return buildKeymap(registry.value);
}

const RUNS_START = { line: '/start', prefill: false };

describe('the /start keys', () => {
  it('build a keymap with no problems', () => {
    expect(shippedKeymap().problems).toStrictEqual([]);
  });

  it('bind w Space in navigation mode only', () => {
    const { insert, navigation } = shippedKeymap();

    expect(navigation.get('w Space')).toStrictEqual(RUNS_START);
    expect(insert.has('w Space')).toBe(false);
  });

  it('bind Ctrl+b Space in both modes', () => {
    const { insert, navigation } = shippedKeymap();

    expect(insert.get('Ctrl+b Space')).toStrictEqual(RUNS_START);
    expect(navigation.get('Ctrl+b Space')).toStrictEqual(RUNS_START);
  });
});
