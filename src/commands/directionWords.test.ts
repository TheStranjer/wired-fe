/**
 * Tests for `/focus` and `/swap` completion (decision 12): after either
 * command Tab offers the directions (and `next`, `prev` for `/focus`) for the
 * first argument, and nowhere else.
 */
import { describe, expect, it } from 'vitest';

import { startCompletion } from './complete';
import { directionOf, directionProvider, focusStepOf } from './directionWords';

/** Every candidate Tab would cycle through for {@link text}. */
function candidates(text: string): readonly string[] {
  return startCompletion(text, text.length, [directionProvider()])?.state.candidates ?? [];
}

describe(directionProvider, () => {
  it('offers the directions and the cycling words after /focus', () => {
    expect(candidates('/focus l')).toStrictEqual(['left']);
    expect(candidates('/focus n')).toStrictEqual(['next']);
    expect(candidates('/focus p')).toStrictEqual(['prev']);
    expect(candidates('/focus d')).toStrictEqual(['down']);
  });

  it('offers only the directions after /swap', () => {
    expect(candidates('/swap r')).toStrictEqual(['right']);
    expect(candidates('/swap n')).toStrictEqual([]);
  });

  it('writes the completed word into the line', () => {
    expect(startCompletion('/swap u', 7, [directionProvider()])?.text).toBe('/swap up ');
  });

  it('matches any case of the command and the word', () => {
    expect(candidates('/FOCUS RI')).toStrictEqual(['right']);
  });

  it('offers nothing for a second argument', () => {
    expect(candidates('/focus left r')).toStrictEqual([]);
  });

  it('does not accept the first word, other commands or a missing line', () => {
    const provider = directionProvider();

    expect(provider.accepts('/focus', true, '/focus')).toBe(false);
    expect(provider.accepts('x', false, '/win x')).toBe(false);
    expect(provider.accepts('x', false)).toBe(false);
    expect(provider.candidates('l')).toStrictEqual([]);
  });
});

describe(directionOf, () => {
  it('reads names and vim letters, and nothing else', () => {
    expect(directionOf('j')).toBe('down');
    expect(directionOf('right')).toBe('right');
    expect(directionOf('next')).toBeNull();
  });
});

describe(focusStepOf, () => {
  it('reads directions and the cycling words, and nothing else', () => {
    expect(focusStepOf('k')).toBe('up');
    expect(focusStepOf('prev')).toBe('prev');
    expect(focusStepOf('previous')).toBeNull();
  });
});
