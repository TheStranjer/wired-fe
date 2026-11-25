/**
 * The reader's own key overrides laid over the defaults by buildKeymap
 * (WFE-130): replace a default binding — its prefill tag does not survive a
 * rebound line —, add a chord no command binds, delete with a null line, and
 * the two refusals that make an override a problem instead: a chord that is
 * not canonical, and a plain character bound in insert mode.
 */
import { describe, expect, it } from 'vitest';

import { buildKeymap } from './keymap';
import type { CommandBinding } from '../commands/bindingTypes';
import { buildRegistry } from '../commands/registry';
import type { CommandDefinition, Registry } from '../commands/types';
import type { KeyOverride } from '../lib/keyOverride';

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

/** The registry built from {@link definitions}; a build error is a broken test. */
function registryOf(definitions: readonly CommandDefinition[]): Registry {
  const result = buildRegistry(definitions);
  if (!result.ok) {
    throw new Error(`buildRegistry unexpectedly rejected definitions: ${result.error}`);
  }
  return result.value;
}

/** One override: {@link chord} bound in {@link mode}; a null {@link line} unbinds. */
function override(mode: KeyOverride['mode'], chord: string, line: string | null): KeyOverride {
  return { mode, chord, line };
}

/** The fixture {@link definitions} with these {@link overrides} applied over them. */
function keymapWith(overrides: readonly KeyOverride[], ...definitions: CommandDefinition[]) {
  return buildKeymap(registryOf(definitions), overrides);
}

describe('buildKeymap with the reader’s overrides', () => {
  it('replaces a default binding and installs the user’s own chord', () => {
    const keymap = keymapWith(
      [override('navigation', 'f', '/pin'), override('insert', 'Alt+k', '/help')],
      withBindings('fav', [{ mode: 'navigation', chord: 'f', args: '' }]),
    );

    expect(keymap.navigation.get('f')).toStrictEqual({ line: '/pin', prefill: false });
    expect(keymap.insert.get('Alt+k')).toStrictEqual({ line: '/help', prefill: false });
    expect(keymap.problems).toStrictEqual([]);
  });

  it('drops a replaced prefill binding’s tag — a rebound line runs', () => {
    const keymap = keymapWith(
      [override('navigation', 'r', '/reply 7')],
      withBindings('reply', [{ mode: 'navigation', chord: 'r', args: '{label}', prefill: true }]),
    );

    expect(keymap.navigation.get('r')).toStrictEqual({ line: '/reply 7', prefill: false });
    expect(keymap.problems).toStrictEqual([]);
  });

  it('deletes a default binding for a null line', () => {
    const keymap = keymapWith(
      [override('insert', 'Alt+3', null)],
      withBindings('win', [{ mode: 'insert', chord: 'Alt+3', args: '3' }]),
    );

    expect(keymap.insert.size).toBe(0);
    expect(keymap.problems).toStrictEqual([]);
  });

  it('unbinding a chord nothing bound is no problem', () => {
    const keymap = keymapWith(
      [override('navigation', 'q', null)],
      withBindings('fav', [{ mode: 'navigation', chord: 'f', args: '' }]),
    );

    expect(keymap.navigation.get('q')).toBeUndefined();
    expect(keymap.navigation.get('f')?.line).toBe('/fav');
    expect(keymap.problems).toStrictEqual([]);
  });

  it('refuses an override whose chord is not canonical', () => {
    const keymap = keymapWith([override('insert', 'alt+3', '/win 3')]);

    expect(keymap.insert.size).toBe(0);
    expect(keymap.problems).toStrictEqual(['override: invalid key alt+3']);
  });

  it('refuses a plain printable chord bound in insert mode', () => {
    const keymap = keymapWith([override('insert', 'x', '/help')]);

    expect(keymap.insert.size).toBe(0);
    expect(keymap.problems).toStrictEqual(['override: x would block typing in insert mode']);
  });

  it('installs that same chord in navigation mode', () => {
    const keymap = keymapWith([override('navigation', 'x', '/help')]);

    expect(keymap.navigation.get('x')).toStrictEqual({ line: '/help', prefill: false });
    expect(keymap.problems).toStrictEqual([]);
  });

  it('lets an override unbind even a plain insert-mode chord', () => {
    const keymap = keymapWith([override('insert', 'x', null)]);

    expect(keymap.insert.size).toBe(0);
    expect(keymap.problems).toStrictEqual([]);
  });

  it('applies overrides in order, the last one for a chord winning', () => {
    const keymap = keymapWith([
      override('navigation', 'Ctrl+e', '/fav'),
      override('navigation', 'Ctrl+e', '/boost'),
    ]);

    expect(keymap.navigation.get('Ctrl+e')).toStrictEqual({ line: '/boost', prefill: false });
    expect(keymap.problems).toStrictEqual([]);
  });

  it('keeps defaults standing where the overrides never touched them', () => {
    const keymap = keymapWith(
      [override('navigation', 'f', '/pin')],
      withBindings('fav', [
        { mode: 'navigation', chord: 'f', args: '' },
        { mode: 'navigation', chord: 'b', args: '' },
      ]),
    );

    expect(keymap.navigation.get('b')).toStrictEqual({ line: '/fav', prefill: false });
  });
});

describe('buildKeymap with sequence overrides', () => {
  it('installs an override sequence and lets a stored single chord stay valid', () => {
    const keymap = keymapWith(
      [override('navigation', 'w v', '/vsplit'), override('navigation', 'f', '/pin')],
      withBindings('fav', [{ mode: 'navigation', chord: 'f', args: '' }]),
    );

    expect(keymap.navigation.get('w v')).toStrictEqual({ line: '/vsplit', prefill: false });
    expect(keymap.navigation.get('f')).toStrictEqual({ line: '/pin', prefill: false });
    expect(keymap.problems).toStrictEqual([]);
  });

  it('deletes a default sequence with a null line', () => {
    const keymap = keymapWith(
      [override('navigation', 'w v', null)],
      withBindings('vsplit', [{ mode: 'navigation', chord: 'w v', args: '' }]),
    );

    expect(keymap.navigation.size).toBe(0);
    expect(keymap.problems).toStrictEqual([]);
  });

  it('refuses an override that is a prefix of a default', () => {
    const keymap = keymapWith(
      [override('navigation', 'w', '/pin')],
      withBindings('vsplit', [{ mode: 'navigation', chord: 'w v', args: '' }]),
    );

    expect(keymap.navigation.has('w')).toBe(false);
    expect(keymap.problems).toStrictEqual(['override: w conflicts with w v']);
  });

  it('refuses an override that extends a default', () => {
    const keymap = keymapWith(
      [override('navigation', 'f x', '/pin')],
      withBindings('fav', [{ mode: 'navigation', chord: 'f', args: '' }]),
    );

    expect(keymap.navigation.has('f x')).toBe(false);
    expect(keymap.problems).toStrictEqual(['override: f x conflicts with f']);
  });

  it('refuses an invalid sequence and an insert sequence led by a plain character', () => {
    const keymap = keymapWith([
      override('navigation', 'w V', '/pin'),
      override('insert', 'w v', '/pin'),
    ]);

    expect(keymap.problems).toStrictEqual([
      'override: invalid key w V',
      'override: w v would block typing in insert mode',
    ]);
  });
});
