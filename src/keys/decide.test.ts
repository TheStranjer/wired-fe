/**
 * The pure key press decision: mode changes first, then the current mode's
 * keymap entry, then nothing.
 */
import { describe, expect, it } from 'vitest';

import { decideKey } from './decide';
import type { Keymap } from './keymap';

/** A keymap with an Alt chord and even an Escape entry in insert mode. */
const KEYMAP: Keymap = {
  insert: new Map([
    ['Alt+3', '/win 3'],
    ['Escape', '/never-runs'],
  ]),
  navigation: new Map([
    ['j', '/next'],
    ['f', '/fav a3'],
  ]),
  problems: [],
};

describe(decideKey, () => {
  it('switches insert to navigation on Escape, even with Escape bound', () => {
    expect(decideKey('insert', 'Escape', KEYMAP)).toStrictEqual({
      kind: 'mode',
      mode: 'navigation',
    });
  });

  it('switches navigation back to insert on i and on Enter', () => {
    expect(decideKey('navigation', 'i', KEYMAP)).toStrictEqual({ kind: 'mode', mode: 'insert' });
    expect(decideKey('navigation', 'Enter', KEYMAP)).toStrictEqual({
      kind: 'mode',
      mode: 'insert',
    });
  });

  it('runs the command line a bound chord carries', () => {
    expect(decideKey('navigation', 'j', KEYMAP)).toStrictEqual({ kind: 'run', line: '/next' });
    expect(decideKey('insert', 'Alt+3', KEYMAP)).toStrictEqual({ kind: 'run', line: '/win 3' });
  });

  it('does nothing for a chord bound only in the other mode', () => {
    expect(decideKey('insert', 'j', KEYMAP)).toStrictEqual({ kind: 'none' });
    expect(decideKey('insert', 'f', KEYMAP)).toStrictEqual({ kind: 'none' });
  });

  it('does nothing for an unbound chord that changes no mode', () => {
    expect(decideKey('navigation', 'q', KEYMAP)).toStrictEqual({ kind: 'none' });
    expect(decideKey('insert', 'i', KEYMAP)).toStrictEqual({ kind: 'none' });
  });
});
