/**
 * Prefix relations between binding sequences: a strict prefix on a chord
 * boundary, the first conflicting key of a set, and whether a prefix leads on.
 */
import { describe, expect, it } from 'vitest';

import { conflictingSequence, hasContinuation, startsSequence } from './sequence';

describe(startsSequence, () => {
  it('is true for a strict prefix on a chord boundary', () => {
    expect(startsSequence('w v', 'w')).toBe(true);
    expect(startsSequence('Ctrl+b % x', 'Ctrl+b %')).toBe(true);
  });

  it('is false for equal sequences, longer prefixes and partial chords', () => {
    expect(startsSequence('w', 'w')).toBe(false);
    expect(startsSequence('w', 'w v')).toBe(false);
    expect(startsSequence('Ctrl+e', 'Ctrl')).toBe(false);
    expect(startsSequence('wx v', 'w')).toBe(false);
  });
});

describe(conflictingSequence, () => {
  it('finds a key the sequence is a prefix of', () => {
    expect(conflictingSequence(['j', 'w v'], 'w')).toBe('w v');
  });

  it('finds a key that is a prefix of the sequence', () => {
    expect(conflictingSequence(['j', 'w'], 'w v')).toBe('w');
  });

  it('is null for unrelated and equal keys', () => {
    expect(conflictingSequence(['j', 'w v'], 'k')).toBeNull();
    expect(conflictingSequence(['w v'], 'w v')).toBeNull();
    expect(conflictingSequence([], 'w')).toBeNull();
  });
});

describe(hasContinuation, () => {
  it('is true when a longer key begins with the prefix', () => {
    expect(hasContinuation(['j', 'w v'], 'w')).toBe(true);
  });

  it('is false when none does, or only the prefix itself is bound', () => {
    expect(hasContinuation(['j', 'w'], 'w')).toBe(false);
    expect(hasContinuation([], 'w')).toBe(false);
  });
});
