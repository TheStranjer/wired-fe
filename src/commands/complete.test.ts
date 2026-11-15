/**
 * Tests for the completion engine: the word it picks out of the line, which
 * provider it asks, what the replacement looks like and how cycling walks the
 * candidate list. The providers here are stubs over fixed word lists; the
 * provider built from the registry has its own file.
 */
import { describe, expect, it } from 'vitest';

import { type CompletionState, type Provider, cycleCompletion, startCompletion } from './complete';

/** A provider for one prefix character, offering the {@link words} that start with the typed word. */
function prefixProvider(prefix: string, words: readonly string[]): Provider {
  return {
    accepts: (word) => word.startsWith(prefix),
    candidates: (word) => words.filter((candidate) => candidate.startsWith(word)),
  };
}

const PEOPLE = prefixProvider('@', ['@alya', '@alice', '@lain']);
const TAGS = prefixProvider('#', ['#art', '#lain']);
const NO_AT_MATCH = prefixProvider('@', ['@nobody']);

/** Command-shaped words, so the engine tests read like the command line. */
const COMMAND_WORDS = ['/about', '/clear', '/close', '/h', '/help'];
const COMMANDISH = prefixProvider('/', COMMAND_WORDS);

/** A completion the engine found, or the failure these tests never expect. */
function completed(
  text: string,
  cursor: number,
  providers: readonly Provider[],
): { readonly text: string; readonly cursor: number; readonly state: CompletionState } {
  const result = startCompletion(text, cursor, providers);
  if (result === null) {
    throw new Error(`startCompletion found nothing to complete in ${text}`);
  }
  return result;
}

/** The state of a completion started at the end of {@link text}. */
function started(text: string, providers: readonly Provider[]): CompletionState {
  return completed(text, text.length, providers).state;
}

describe(startCompletion, () => {
  it('replaces the word ending at the cursor with the first candidate and a space', () => {
    expect(startCompletion('/he', 3, [COMMANDISH])).toStrictEqual({
      text: '/help ',
      cursor: 6,
      state: { original: '/he', cursor: 3, candidates: ['/help'], index: 0, wordStart: 0 },
    });
  });

  it('completes a word in the middle of the line and keeps the text around it', () => {
    expect(startCompletion('to @al pong', 6, [PEOPLE])).toStrictEqual({
      text: 'to @alya  pong',
      cursor: 9,
      state: {
        original: 'to @al pong',
        cursor: 6,
        candidates: ['@alya', '@alice'],
        index: 0,
        wordStart: 3,
      },
    });
  });

  it('takes the run ending at the cursor as the word, not the whole word', () => {
    expect(completed('@lainward', 5, [PEOPLE]).text).toBe('@lain ward');
  });

  it('clamps a cursor past the end of the text to its end', () => {
    expect(startCompletion('/he', 99, [COMMANDISH])).toStrictEqual(
      startCompletion('/he', 3, [COMMANDISH]),
    );
  });

  it('asks the first provider that accepts the word', () => {
    expect(startCompletion('#la', 3, [PEOPLE, TAGS])).toStrictEqual({
      text: '#lain ',
      cursor: 6,
      state: { original: '#la', cursor: 3, candidates: ['#lain'], index: 0, wordStart: 0 },
    });
  });

  it('returns null when the word is empty', () => {
    expect(startCompletion('', 0, [COMMANDISH])).toBeNull();
    expect(startCompletion('/help ', 6, [COMMANDISH])).toBeNull();
    expect(startCompletion('/help', 0, [COMMANDISH])).toBeNull();
  });

  it('returns null when no provider accepts the word', () => {
    expect(startCompletion('hello', 5, [COMMANDISH, PEOPLE])).toBeNull();
  });

  it('returns null when the accepting provider has nothing to offer', () => {
    expect(startCompletion('@al', 3, [NO_AT_MATCH, PEOPLE])).toBeNull();
  });
});

describe(cycleCompletion, () => {
  it('shows the next candidate in place of the one before it', () => {
    const state = started('/c', [COMMANDISH]);

    expect(state.candidates).toStrictEqual(['/clear', '/close']);
    expect(cycleCompletion(state, 1)).toStrictEqual({
      text: '/close ',
      cursor: 7,
      state: {
        original: '/c',
        cursor: 2,
        candidates: ['/clear', '/close'],
        index: 1,
        wordStart: 0,
      },
    });
  });

  it('shows the previous candidate on the way back', () => {
    const forward = cycleCompletion(started('/c', [COMMANDISH]), 1);
    const back = cycleCompletion(forward.state, -1);

    expect(back.text).toBe('/clear ');
    expect(back.cursor).toBe(7);
    expect(back.state.index).toBe(0);
  });

  it('wraps backward from the first candidate to the last', () => {
    const last = cycleCompletion(started('/', [COMMANDISH]), -1);

    expect(last.text).toBe('/help ');
    expect(last.cursor).toBe(6);
    expect(last.state.index).toBe(COMMAND_WORDS.length - 1);
  });

  it('wraps forward from the last candidate to the first', () => {
    const state = cycleCompletion(started('/', [COMMANDISH]), -1).state;
    const first = cycleCompletion(state, 1);

    expect(first.text).toBe('/about ');
    expect(first.state.index).toBe(0);
  });

  it('walks the whole list and wraps back to where it started', () => {
    const first = completed('/', 1, [COMMANDISH]);
    const seen: string[] = [first.text];
    let state = first.state;
    while (seen.length < COMMAND_WORDS.length) {
      const step = cycleCompletion(state, 1);
      seen.push(step.text);
      state = step.state;
    }

    expect(seen).toStrictEqual(COMMAND_WORDS.map((word) => `${word} `));
    expect(cycleCompletion(state, 1).text).toBe(first.text);
  });

  it('keeps the rest of the line while cycling', () => {
    const state = completed('to @al pong', 6, [PEOPLE]).state;

    expect(cycleCompletion(state, 1)).toStrictEqual({
      text: 'to @alice  pong',
      cursor: 10,
      state: {
        original: 'to @al pong',
        cursor: 6,
        candidates: ['@alya', '@alice'],
        index: 1,
        wordStart: 3,
      },
    });
  });

  it('replaces the shown candidate instead of growing the line', () => {
    const state = started('/c', [COMMANDISH]);

    expect(cycleCompletion(state, 1).text).toBe('/close ');
    expect(cycleCompletion(state, 1).state.original).toBe('/c');
  });

  it('leaves a state without candidates alone', () => {
    const state: CompletionState = {
      original: '@nope',
      cursor: 5,
      candidates: [],
      index: 0,
      wordStart: 0,
    };

    expect(cycleCompletion(state, 1)).toStrictEqual({ text: '@nope', cursor: 5, state });
  });
});
