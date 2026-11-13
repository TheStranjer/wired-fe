/**
 * The insert/navigation mode state machine over canonical chords.
 */
import { describe, expect, it } from 'vitest';

import { nextMode } from './mode';
import type { InputMode } from './mode';

type ModeCase = {
  readonly label: string;
  readonly mode: InputMode;
  readonly chord: string;
  readonly expected: InputMode | null;
};

const TRANSITION_CASES: readonly ModeCase[] = [
  { label: 'Escape enters navigation', mode: 'insert', chord: 'Escape', expected: 'navigation' },
  { label: 'i does nothing while inserting', mode: 'insert', chord: 'i', expected: null },
  { label: 'Enter does nothing while inserting', mode: 'insert', chord: 'Enter', expected: null },
  { label: 'Shift+Escape is not Escape', mode: 'insert', chord: 'Shift+Escape', expected: null },
  { label: 'i returns to insert', mode: 'navigation', chord: 'i', expected: 'insert' },
  { label: 'Enter returns to insert', mode: 'navigation', chord: 'Enter', expected: 'insert' },
  { label: 'Escape stays navigating', mode: 'navigation', chord: 'Escape', expected: null },
  { label: 'action chords do not change mode', mode: 'navigation', chord: 'j', expected: null },
  { label: 'Shift+i is not i', mode: 'navigation', chord: 'Shift+i', expected: null },
];

describe(nextMode, () => {
  it.each(TRANSITION_CASES)('$label', ({ mode, chord, expected }) => {
    expect(nextMode(mode, chord)).toBe(expected);
  });
});
