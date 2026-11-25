/**
 * Tests for the completion of view names (decision 6): the first argument of
 * the split commands completes to the view words, and nothing else does.
 */
import { describe, expect, it } from 'vitest';

import { startCompletion } from './complete';
import { viewProvider } from './viewProvider';

/** What Tab writes for {@link text} with the cursor at its end, or null. */
function tab(text: string): string | null {
  return startCompletion(text, text.length, [viewProvider()])?.text ?? null;
}

/** Every candidate Tab would cycle through for {@link text}. */
function candidates(text: string): readonly string[] {
  return startCompletion(text, text.length, [viewProvider()])?.state.candidates ?? [];
}

describe(viewProvider, () => {
  it('offers the views starting with the typed letters after either split command', () => {
    expect(candidates('/vsplit s')).toStrictEqual(['search']);
    expect(candidates('/split t')).toStrictEqual(['tag', 'thread']);
    expect(candidates('/vs w')).toStrictEqual(['whois', 'win']);
    expect(candidates('/sp n')).toStrictEqual(['notifications']);
  });

  it('completes in place with the word and a space', () => {
    expect(tab('/vsplit ho')).toBe('/vsplit home ');
  });

  it('matches any case of the command and the word', () => {
    expect(tab('/VSPLIT HO')).toBe('/VSPLIT home ');
  });

  it('offers nothing after the first argument, after another command or for the command itself', () => {
    expect(tab('/vsplit tag r')).toBeNull();
    expect(tab('/win h')).toBeNull();
    expect(tab('/vsplit')).toBeNull();
  });

  it('declines when the engine passes no line', () => {
    expect(viewProvider().accepts('h', false)).toBe(false);
  });
});
