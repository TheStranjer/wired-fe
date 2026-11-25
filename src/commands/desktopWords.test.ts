/**
 * Tests for `/desktop` and `/mvd` completion (decision 18): after `/desktop `
 * Tab offers the forms, after `/mvd <number> ` it offers `follow`, and nowhere
 * else.
 */
import { describe, expect, it } from 'vitest';

import { startCompletion } from './complete';
import { desktopProvider } from './desktopWords';

/** What Tab writes for {@link text} with the cursor at its end, or null. */
function tab(text: string): string | null {
  return startCompletion(text, text.length, [desktopProvider()])?.text ?? null;
}

/** Every candidate Tab would cycle through for {@link text}. */
function candidates(text: string): readonly string[] {
  return startCompletion(text, text.length, [desktopProvider()])?.state.candidates ?? [];
}

describe(desktopProvider, () => {
  it('offers the forms after /desktop and its alias', () => {
    expect(candidates('/desktop l')).toStrictEqual(['list']);
    expect(candidates('/d n')).toStrictEqual(['new', 'next']);
    expect(tab('/desktop c')).toBe('/desktop close ');
    expect(tab('/desktop pru')).toBe('/desktop prune ');
  });

  it('matches any case of the command and the word', () => {
    expect(tab('/DESKTOP P')).toBe('/DESKTOP prev ');
  });

  it('offers follow after /mvd and a number', () => {
    expect(candidates('/mvd 3 f')).toStrictEqual(['follow']);
    expect(tab('/mvd 12 fo')).toBe('/mvd 12 follow ');
  });

  it('offers nothing where a number or nothing goes', () => {
    expect(tab('/desktop close n')).toBeNull();
    expect(tab('/mvd f')).toBeNull();
    expect(tab('/mvd x f')).toBeNull();
    expect(tab('/mvd 3 follow f')).toBeNull();
    expect(tab('/win n')).toBeNull();
  });

  it('declines the first word and offers nothing without a line', () => {
    const provider = desktopProvider();

    expect(provider.accepts('/d', true, '/d')).toBe(false);
    expect(provider.accepts('n', false)).toBe(false);
    expect(provider.candidates('n')).toStrictEqual([]);
  });
});
