/**
 * Tests for the signed-out refusal slice (WFE-340): `anonRefused` records the
 * key once, `anonHandled` clears it, and either leaves the state alone when it
 * would change nothing.
 */
import { describe, expect, it } from 'vitest';

import { anonKey } from './anonAccount';
import { initialAppState } from './appState';
import { appReducer } from './reducer';

const KEY = anonKey('https://wired.example');

describe('anonRefused and anonHandled', () => {
  it('records a refusal and clears it when handled', () => {
    const refused = appReducer(initialAppState(), { type: 'anonRefused', accountKey: KEY });

    expect([...refused.anonRefused]).toStrictEqual([KEY]);
    expect([
      ...appReducer(refused, { type: 'anonHandled', accountKey: KEY }).anonRefused,
    ]).toStrictEqual([]);
  });

  it('keeps the same state for a refusal already recorded and a handling of none', () => {
    const start = initialAppState();
    const refused = appReducer(start, { type: 'anonRefused', accountKey: KEY });

    expect(appReducer(refused, { type: 'anonRefused', accountKey: KEY })).toBe(refused);
    expect(appReducer(start, { type: 'anonHandled', accountKey: KEY })).toBe(start);
  });

  it('keeps other keys when one is handled', () => {
    const other = anonKey('https://b.example');
    const both = [KEY, other].reduce(
      (state, accountKey) => appReducer(state, { type: 'anonRefused', accountKey }),
      initialAppState(),
    );

    expect([
      ...appReducer(both, { type: 'anonHandled', accountKey: KEY }).anonRefused,
    ]).toStrictEqual([other]);
  });
});
