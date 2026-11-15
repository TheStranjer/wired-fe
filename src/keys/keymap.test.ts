/**
 * The keymap generated from the command registry: the command-line entries
 * bindings produce, run or prefill, the three refusals (non-canonical chord,
 * a chord that would block typing in insert mode, a chord another command
 * already took), and that the shipped commands' bindings all install without
 * one.
 */
import { describe, expect, it } from 'vitest';

import { buildKeymap } from './keymap';
import type { Keymap } from './keymap';
import { loadDefinitions } from '../commands/definitions';
import { buildRegistry } from '../commands/registry';
import type { CommandBinding, CommandDefinition, Registry } from '../commands/types';

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

/** The registry built from {@link definitions}, throwing on a build error. */
function registryOf(definitions: readonly CommandDefinition[]): Registry {
  const result = buildRegistry(definitions);
  if (!result.ok) {
    throw new Error(`buildRegistry unexpectedly rejected definitions: ${result.error}`);
  }
  return result.value;
}

/** The keymap built straight from fixture {@link definitions}. */
function keymapOf(...definitions: readonly CommandDefinition[]): Keymap {
  return buildKeymap(registryOf(definitions));
}

/** The definitions the shipped defs folder exports, throwing when it fails. */
function shippedDefinitions(): readonly CommandDefinition[] {
  const result = loadDefinitions();
  if (!result.ok) {
    throw new Error(`loadDefinitions unexpectedly rejected the defs folder: ${result.error}`);
  }
  return result.value;
}

describe(buildKeymap, () => {
  it('yields empty maps and no problems when no command binds a key', () => {
    const keymap = keymapOf({
      name: 'dm',
      aliases: [],
      usage: '/dm <actor> <text>',
      summary: 'Send a direct message.',
      run: async () => await Promise.resolve({ ok: true }),
    });

    expect(keymap.insert.size).toBe(0);
    expect(keymap.navigation.size).toBe(0);
    expect(keymap.problems).toStrictEqual([]);
  });

  it('maps a chord to the command line with and without args', () => {
    const keymap = keymapOf(
      withBindings('win', [{ mode: 'insert', chord: 'Alt+3', args: '3' }]),
      withBindings('fav', [{ mode: 'navigation', chord: 'f', args: '' }]),
    );

    expect(keymap.insert.get('Alt+3')).toStrictEqual({ line: '/win 3', prefill: false });
    expect(keymap.navigation.get('f')).toStrictEqual({ line: '/fav', prefill: false });
    expect(keymap.problems).toStrictEqual([]);
  });

  it('carries a binding’s prefill flag into the entry', () => {
    const keymap = keymapOf(
      withBindings('reply', [{ mode: 'navigation', chord: 'r', args: '{label}', prefill: true }]),
      withBindings('win', [{ mode: 'insert', chord: 'Alt+3', args: '3', prefill: false }]),
    );

    expect(keymap.navigation.get('r')).toStrictEqual({ line: '/reply {label}', prefill: true });
    expect(keymap.insert.get('Alt+3')).toStrictEqual({ line: '/win 3', prefill: false });
    expect(keymap.problems).toStrictEqual([]);
  });

  it('keeps the same chord usable in both modes', () => {
    const keymap = keymapOf(
      withBindings('win', [
        { mode: 'insert', chord: 'Alt+ArrowRight', args: 'next' },
        { mode: 'navigation', chord: 'Alt+ArrowRight', args: 'prev' },
      ]),
    );

    expect(keymap.insert.get('Alt+ArrowRight')).toStrictEqual({
      line: '/win next',
      prefill: false,
    });
    expect(keymap.navigation.get('Alt+ArrowRight')).toStrictEqual({
      line: '/win prev',
      prefill: false,
    });
    expect(keymap.problems).toStrictEqual([]);
  });

  it('rejects a non-canonical chord, naming it', () => {
    const keymap = keymapOf(withBindings('win', [{ mode: 'insert', chord: 'alt+3', args: '3' }]));

    expect(keymap.problems).toStrictEqual(['/win: invalid key alt+3']);
    expect(keymap.insert.size).toBe(0);
  });

  it('rejects a chord that names no bindable key', () => {
    const keymap = keymapOf(
      withBindings('win', [{ mode: 'navigation', chord: 'ctrl+', args: 'next' }]),
    );

    expect(keymap.problems).toStrictEqual(['/win: invalid key ctrl+']);
    expect(keymap.navigation.size).toBe(0);
  });

  it('rejects a plain printable chord in insert mode', () => {
    const keymap = keymapOf(withBindings('fav', [{ mode: 'insert', chord: 'a', args: '' }]));

    expect(keymap.problems).toStrictEqual(['/fav: a would block typing in insert mode']);
    expect(keymap.insert.size).toBe(0);
  });

  it('rejects Shift+a in insert mode but installs it in navigation mode', () => {
    const keymap = keymapOf(
      withBindings('fav', [
        { mode: 'insert', chord: 'Shift+a', args: '' },
        { mode: 'navigation', chord: 'Shift+a', args: '' },
      ]),
    );

    expect(keymap.problems).toStrictEqual(['/fav: Shift+a would block typing in insert mode']);
    expect(keymap.insert.size).toBe(0);
    expect(keymap.navigation.get('Shift+a')).toStrictEqual({ line: '/fav', prefill: false });
  });

  it('installs a printable chord in navigation mode and a named key in insert mode', () => {
    const keymap = keymapOf(
      withBindings('next', [{ mode: 'navigation', chord: 'j', args: '' }]),
      withBindings('help', [{ mode: 'insert', chord: 'F1', args: '' }]),
    );

    expect(keymap.navigation.get('j')).toStrictEqual({ line: '/next', prefill: false });
    expect(keymap.insert.get('F1')).toStrictEqual({ line: '/help', prefill: false });
    expect(keymap.problems).toStrictEqual([]);
  });

  it('refuses a taken chord and keeps the first binding by command name', () => {
    const keymap = keymapOf(
      withBindings('zulu', [{ mode: 'navigation', chord: 'j', args: 'last' }]),
      withBindings('alpha', [{ mode: 'navigation', chord: 'j', args: 'first' }]),
    );

    expect(keymap.navigation.get('j')).toStrictEqual({ line: '/alpha first', prefill: false });
    expect(keymap.problems).toStrictEqual(['/zulu: j already bound to /alpha first']);
  });

  it('collects every problem of every command in registry order', () => {
    const keymap = keymapOf(
      withBindings('bravo', [
        { mode: 'insert', chord: 'x', args: '' },
        { mode: 'navigation', chord: 'Bad', args: '' },
        { mode: 'navigation', chord: 'k', args: '' },
      ]),
      withBindings('alpha', [{ mode: 'navigation', chord: 'k', args: '1' }]),
    );

    expect(keymap.navigation.get('k')).toStrictEqual({ line: '/alpha 1', prefill: false });
    expect(keymap.problems).toStrictEqual([
      '/bravo: x would block typing in insert mode',
      '/bravo: invalid key Bad',
      '/bravo: k already bound to /alpha 1',
    ]);
  });

  it('installs every binding the shipped commands declare', () => {
    expect(buildKeymap(registryOf(shippedDefinitions())).problems).toStrictEqual([]);
  });
});
