/**
 * Tests for `/display` completion (decision 15): after `/display ` Tab offers
 * the keys and `reset`, after a key its values, after `reset` the keys, and
 * nowhere else.
 */
import { describe, expect, it } from 'vitest';

import { startCompletion } from './complete';
import { displayProvider } from './displayWords';

/** What Tab writes for {@link text} with the cursor at its end, or null. */
function tab(text: string): string | null {
  return startCompletion(text, text.length, [displayProvider()])?.text ?? null;
}

/** Every candidate Tab would cycle through for {@link text}. */
function candidates(text: string): readonly string[] {
  return startCompletion(text, text.length, [displayProvider()])?.state.candidates ?? [];
}

describe(displayProvider, () => {
  it('offers the keys and reset for the first argument', () => {
    expect(candidates('/display r')).toStrictEqual(['reset']);
    expect(candidates('/display a')).toStrictEqual(['avatars']);
    expect(tab('/display d')).toBe('/display density ');
  });

  it('offers a key’s values after the key', () => {
    expect(candidates('/display density l')).toStrictEqual(['lines']);
    expect(candidates('/display density c')).toStrictEqual(['cards']);
    expect(candidates('/display avatars o')).toStrictEqual(['off', 'on']);
    expect(candidates('/display images f')).toStrictEqual(['false']);
  });

  it('offers the keys after reset', () => {
    expect(candidates('/display reset i')).toStrictEqual(['images']);
  });

  it('matches any case of the command and the word', () => {
    expect(tab('/DISPLAY D')).toBe('/DISPLAY density ');
  });

  it('offers nothing after a key it does not know or past the second word', () => {
    expect(tab('/display theme l')).toBeNull();
    expect(tab('/display density lines l')).toBeNull();
    expect(tab('/display reset density i')).toBeNull();
  });

  it('declines and offers the keys when the engine passes no line', () => {
    const provider = displayProvider();

    expect(provider.accepts('d', false)).toBe(false);
    expect(provider.candidates('r')).toStrictEqual(['reset']);
  });

  it('leaves the command word and other commands alone', () => {
    expect(tab('/disp')).toBeNull();
    expect(tab('/set d')).toBeNull();
  });
});
