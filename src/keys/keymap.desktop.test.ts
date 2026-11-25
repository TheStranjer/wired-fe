/**
 * The shipped keymap's desktop hotkeys (decision 18): Alt+digits and Alt+brackets
 * belong to `/desktop`, while bare digits and Alt+arrows stay with `/win`.
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

/** The entry a chord runs without prefilling. */
function runs(line: string): { readonly line: string; readonly prefill: false } {
  return { line, prefill: false };
}

describe('the desktop hotkeys', () => {
  it('bind Alt+digits and Alt+brackets to /desktop in insert mode', () => {
    const { insert } = shippedKeymap();

    expect(insert.get('Alt+3')).toStrictEqual(runs('/desktop 3'));
    expect(insert.get('Alt+0')).toStrictEqual(runs('/desktop 10'));
    expect(insert.get('Alt+[')).toStrictEqual(runs('/desktop prev'));
    expect(insert.get('Alt+]')).toStrictEqual(runs('/desktop next'));
  });

  it('bind Alt+brackets in navigation mode and leave windows to /win', () => {
    const { insert, navigation } = shippedKeymap();

    expect(navigation.get('Alt+[')).toStrictEqual(runs('/desktop prev'));
    expect(navigation.get('Alt+]')).toStrictEqual(runs('/desktop next'));
    expect(navigation.get('3')).toStrictEqual(runs('/win 3'));
    expect(navigation.get('Alt+3')).toBeUndefined();
    expect(insert.get('Alt+ArrowRight')).toStrictEqual(runs('/win next'));
  });
});
