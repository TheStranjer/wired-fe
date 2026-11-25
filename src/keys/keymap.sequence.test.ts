/**
 * The keymap with key sequences (decision 18): multi-chord bindings keyed by
 * the whole sequence, canonical-form and insert-mode typing checks over it,
 * and the prefix conflicts — `w` beside `w v` — refused with the first
 * binding in registry order winning.
 */
import { describe, expect, it } from 'vitest';

import { buildKeymap } from './keymap';
import type { CommandBinding, Keymap } from '../commands/bindingTypes';
import { buildRegistry } from '../commands/registry';
import type { CommandDefinition } from '../commands/types';

/** A fixture command named {@link name} declaring {@link bindings}. */
function withBindings(name: string, bindings: readonly CommandBinding[]): CommandDefinition {
  return {
    name,
    aliases: [],
    usage: `/${name}`,
    summary: `Test command ${name}.`,
    run: async () => await Promise.resolve({ ok: true }),
    bindings,
  };
}

/** The keymap built straight from fixture {@link definitions}. */
function keymapOf(...definitions: readonly CommandDefinition[]): Keymap {
  const result = buildRegistry(definitions);
  if (!result.ok) {
    throw new Error(`buildRegistry unexpectedly rejected definitions: ${result.error}`);
  }
  return buildKeymap(result.value);
}

describe('buildKeymap with key sequences', () => {
  it('installs multi-chord bindings keyed by the whole sequence', () => {
    const keymap = keymapOf(
      withBindings('vsplit', [
        { mode: 'navigation', chord: 'w v', args: '' },
        { mode: 'insert', chord: 'Ctrl+b %', args: '' },
      ]),
    );

    expect(keymap.navigation.get('w v')).toStrictEqual({ line: '/vsplit', prefill: false });
    expect(keymap.insert.get('Ctrl+b %')).toStrictEqual({ line: '/vsplit', prefill: false });
    expect(keymap.problems).toStrictEqual([]);
  });

  it('rejects a sequence with a non-canonical chord in it', () => {
    const keymap = keymapOf(
      withBindings('vsplit', [{ mode: 'navigation', chord: 'w V', args: '' }]),
    );

    expect(keymap.problems).toStrictEqual(['/vsplit: invalid key w V']);
    expect(keymap.navigation.size).toBe(0);
  });

  it('judges insert-mode typing by the first chord only', () => {
    const keymap = keymapOf(
      withBindings('split', [
        { mode: 'insert', chord: 'Ctrl+b %', args: '' },
        { mode: 'insert', chord: 'w v', args: '' },
      ]),
    );

    expect(keymap.insert.has('Ctrl+b %')).toBe(true);
    expect(keymap.problems).toStrictEqual(['/split: w v would block typing in insert mode']);
  });

  it('refuses a binding that is a prefix of an earlier one, first in registry order winning', () => {
    const keymap = keymapOf(
      withBindings('alpha', [{ mode: 'navigation', chord: 'w v', args: '' }]),
      withBindings('zulu', [{ mode: 'navigation', chord: 'w', args: '' }]),
    );

    expect(keymap.navigation.has('w v')).toBe(true);
    expect(keymap.navigation.has('w')).toBe(false);
    expect(keymap.problems).toStrictEqual(['/zulu: w conflicts with w v']);
  });

  it('refuses a binding that has an earlier one as its prefix', () => {
    const keymap = keymapOf(
      withBindings('alpha', [{ mode: 'navigation', chord: 'w', args: '' }]),
      withBindings('zulu', [{ mode: 'navigation', chord: 'w v', args: '' }]),
    );

    expect(keymap.navigation.has('w')).toBe(true);
    expect(keymap.navigation.has('w v')).toBe(false);
    expect(keymap.problems).toStrictEqual(['/zulu: w v conflicts with w']);
  });

  it('lets sequences sharing a prefix coexist, and the same sequence live in each mode', () => {
    const keymap = keymapOf(
      withBindings('split', [
        { mode: 'navigation', chord: 'w v', args: '' },
        { mode: 'navigation', chord: 'w s', args: '' },
        { mode: 'insert', chord: 'Ctrl+b w', args: '' },
        { mode: 'navigation', chord: 'Ctrl+b w', args: '' },
      ]),
    );

    expect(keymap.navigation.size).toBe(3);
    expect(keymap.insert.size).toBe(1);
    expect(keymap.problems).toStrictEqual([]);
  });
});
