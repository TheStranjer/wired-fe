/**
 * Tests for the post-label provider (WFE-301): which words it accepts by
 * position and prefix, which labels it offers (the active window's, newest
 * first, only while their lines are still in the scrollback), what each is
 * completed to (bare in an argument, bracketed when typed with `[`) and how
 * each is described: plain text, a content warning in place of the body, a
 * boost under the original's author.
 */
import { describe, expect, it } from 'vitest';

import { labelProvider } from './labelProvider';
import type { AppState } from '../state/appState';
import { activeBuffer } from '../state/selectors';
import { author, sessionWith } from '../test/completionSessions';
import { notification, status } from '../test/fixtures';
import { activeWindow } from '../windows/model';

/** The commands the provider offers labels to: `f` is an alias of `fav`. */
const COMMANDS: ReadonlySet<string> = new Set(['fav', 'f', 'reply']);

/** Three posts, `a` the oldest: labelled `a0`, `a1`, `a2`. */
function three(): AppState {
  return sessionWith({
    statuses: [status('c'), status('b'), status('a')],
  });
}

/** The provider over {@link state}, for the commands of {@link COMMANDS}. */
function over(state: AppState): ReturnType<typeof labelProvider> {
  return labelProvider(state, COMMANDS);
}

/** {@link state} with the lines the active window shows narrowed by {@link keep}. */
function scrolled(state: AppState, keep: (id: string) => boolean): AppState {
  const { id } = activeWindow(state.windows);
  const buffer = activeBuffer(state);
  const lines = buffer.lines.filter((line) => line.kind !== 'post' || keep(line.status.id));
  return { ...state, buffers: new Map(state.buffers).set(id, { ...buffer, lines }) };
}

describe('labelProvider accepts', () => {
  const provider = over(three());

  it('asks to be consulted about an empty word', () => {
    expect(provider.bare).toBe(true);
  });

  it('takes a word typed with a bracket, anywhere on the line', () => {
    expect(provider.accepts('[', true, '[')).toBe(true);
    expect(provider.accepts('[a3', false, 'look at [a3')).toBe(true);
    expect(provider.accepts('[a3]', false, '/home [a3]')).toBe(true);
  });

  it('takes a label-shaped first argument of a command that takes a post', () => {
    expect(provider.accepts('a', false, '/fav a')).toBe(true);
    expect(provider.accepts('a3', false, '/fav a3')).toBe(true);
    expect(provider.accepts('', false, '/fav ')).toBe(true);
    expect(provider.accepts('A', false, '/FAV A')).toBe(true);
    expect(provider.accepts('a', false, '/f a')).toBe(true);
  });

  it('leaves a word in the wrong place to the other providers', () => {
    expect(provider.accepts('a', true, 'a')).toBe(false);
    expect(provider.accepts('a', false, '/home a')).toBe(false);
    expect(provider.accepts('a', false, 'hello a')).toBe(false);
    expect(provider.accepts('a', false)).toBe(false);
  });

  it('leaves a word that is no label to the other providers', () => {
    expect(provider.accepts('@bo', false, '/fav @bo')).toBe(false);
    expect(provider.accepts('#tag', false, '/fav #tag')).toBe(false);
    expect(provider.accepts('a33', false, '/fav a33')).toBe(false);
  });
});

describe('labelProvider candidates', () => {
  it('offers the labels of the active window, newest first, bare in an argument', () => {
    const provider = over(three());

    expect(provider.candidates('', '/fav ')).toStrictEqual(['a2', 'a1', 'a0']);
    expect(provider.candidates('a', '/fav ')).toStrictEqual(['a2', 'a1', 'a0']);
  });

  it('narrows to the typed prefix, in any case', () => {
    const provider = over(three());

    expect(provider.candidates('a1', '/fav ')).toStrictEqual(['a1']);
    expect(provider.candidates('A1', '/reply ')).toStrictEqual(['a1']);
    expect(provider.candidates('b', '/fav ')).toStrictEqual([]);
  });

  it('completes a word typed with a bracket to the bracketed label, wherever it stands', () => {
    const provider = over(three());

    expect(provider.candidates('[', 'hello ')).toStrictEqual(['[a2]', '[a1]', '[a0]']);
    expect(provider.candidates('[a1', '/home ')).toStrictEqual(['[a1]']);
    expect(provider.candidates('[A1]')).toStrictEqual(['[a1]']);
    expect(provider.candidates('[z')).toStrictEqual([]);
  });

  it('offers nothing outside the first argument of a command that takes a post', () => {
    const provider = over(three());

    expect(provider.candidates('a')).toStrictEqual([]);
    expect(provider.candidates('a', '/home ')).toStrictEqual([]);
    expect(provider.candidates('a', 'say ')).toStrictEqual([]);
    expect(provider.candidates('a', '/fav a1 ')).toStrictEqual([]);
  });

  it('leaves out a label whose line has scrolled out of the window', () => {
    const state = scrolled(three(), (id) => id !== 'b');

    expect(over(state).candidates('', '/fav ')).toStrictEqual(['a2', 'a0']);
    expect(over(state).describe?.('a1')).toBeUndefined();
  });

  it('offers a notification post, a boost and a quote by the label of the line showing it', () => {
    const state = sessionWith({
      notifications: [notification('n1', status('s1'))],
      statuses: [
        status('p', { quote: status('inner', { account: author('carol@q.example') }) }),
        status('r', { reblog: status('orig') }),
      ],
    });

    expect(over(state).candidates('', '/fav ')).toStrictEqual(['a3', 'a1', 'a2', 'a0']);
  });

  it('offers a label once when two lines show the same quote', () => {
    const shared = status('shared');
    const state = sessionWith({
      statuses: [status('q2', { quote: shared }), status('q1', { quote: shared })],
    });

    expect(over(state).candidates('', '/fav ')).toStrictEqual(['a2', 'a1', 'a0']);
  });

  it('skips a quote the window gave no label and a line that carries no post', () => {
    const state = sessionWith({
      notifications: [notification('n1', status('s1', { quote: status('unlabelled') }))],
    });

    expect(over(state).candidates('', '/fav ')).toStrictEqual(['a0']);
  });

  it('offers at most fifty', () => {
    const sixty = Array.from({ length: 60 }, (_unused, index) => status(`many-${String(index)}`));
    const candidates = over(sessionWith({ statuses: sixty })).candidates('', '/fav ');

    expect(candidates).toHaveLength(50);
    expect(candidates[0]).toBe('f9');
  });
});
