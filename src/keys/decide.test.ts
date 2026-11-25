/**
 * The pure key press decision: mode changes first, then the current mode's
 * keymap entry — run or prefill — then nothing.
 */
import { describe, expect, it } from 'vitest';

import { continueKey, decideKey } from './decide';
import type { Keymap } from '../commands/types';

/** A keymap with an Alt chord and even an Escape entry in insert mode. */
const KEYMAP: Keymap = {
  insert: new Map([
    ['Alt+3', { line: '/win 3', prefill: false }],
    ['Escape', { line: '/never-runs', prefill: false }],
  ]),
  navigation: new Map([
    ['j', { line: '/next', prefill: false }],
    ['f', { line: '/fav a3', prefill: false }],
    ['r', { line: '/reply {label}', prefill: true }],
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

  it('prefills the command line when the binding asks for it', () => {
    expect(decideKey('navigation', 'r', KEYMAP)).toStrictEqual({
      kind: 'prefill',
      line: '/reply {label}',
    });
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

/** A keymap with sequences: `w v` and `w s` under the prefix `w`, `Ctrl+b %` in both modes. */
const SEQUENCES: Keymap = {
  insert: new Map([['Ctrl+b %', { line: '/vsplit', prefill: false }]]),
  navigation: new Map([
    ['w v', { line: '/vsplit', prefill: false }],
    ['w s', { line: '/split', prefill: false }],
    ['w r', { line: '/reply {label}', prefill: true }],
    ['Ctrl+b %', { line: '/vsplit', prefill: false }],
    ['j', { line: '/next', prefill: false }],
  ]),
  problems: [],
};

describe('decideKey with sequences', () => {
  it('waits when a chord begins longer bindings', () => {
    expect(decideKey('navigation', 'w', SEQUENCES)).toStrictEqual({
      kind: 'pending',
      prefix: 'w',
    });
    expect(decideKey('insert', 'Ctrl+b', SEQUENCES)).toStrictEqual({
      kind: 'pending',
      prefix: 'Ctrl+b',
    });
  });

  it('does not take a prefix of the other mode’s sequences', () => {
    expect(decideKey('insert', 'w', SEQUENCES)).toStrictEqual({ kind: 'none' });
  });

  it('still lets a mode chord win over a pending prefix', () => {
    expect(decideKey('navigation', 'i', SEQUENCES)).toStrictEqual({ kind: 'mode', mode: 'insert' });
  });
});

describe(continueKey, () => {
  it('runs the binding the second chord completes', () => {
    expect(continueKey(SEQUENCES.navigation, 'w', 'v')).toStrictEqual({
      kind: 'run',
      line: '/vsplit',
    });
    expect(continueKey(SEQUENCES.insert, 'Ctrl+b', '%')).toStrictEqual({
      kind: 'run',
      line: '/vsplit',
    });
  });

  it('prefills when the completed binding is a prefill', () => {
    expect(continueKey(SEQUENCES.navigation, 'w', 'r')).toStrictEqual({
      kind: 'prefill',
      line: '/reply {label}',
    });
  });

  it('stays pending, with the longer prefix, while chords remain', () => {
    const map = new Map([['a b c', { line: '/abc', prefill: false }]]);

    expect(continueKey(map, 'a', 'b')).toStrictEqual({ kind: 'pending', prefix: 'a b' });
    expect(continueKey(map, 'a b', 'c')).toStrictEqual({ kind: 'run', line: '/abc' });
  });

  it('cancels on a chord that continues nothing', () => {
    expect(continueKey(SEQUENCES.navigation, 'w', 'x')).toStrictEqual({ kind: 'cancel' });
    expect(continueKey(SEQUENCES.navigation, 'w', 'j')).toStrictEqual({ kind: 'cancel' });
  });

  it('cancels on Escape', () => {
    expect(continueKey(SEQUENCES.navigation, 'w', 'Escape')).toStrictEqual({ kind: 'cancel' });
  });

  it('does not treat a mode chord as a continuation', () => {
    expect(continueKey(SEQUENCES.navigation, 'w', 'i')).toStrictEqual({ kind: 'cancel' });
  });
});
