/**
 * Tests for the post-label provider of the post text boxes (WFE-302): only a
 * word typed with `[` is taken, its candidates are the links of the posts of
 * the given windows (the web page when a post has one, else its canonical id,
 * a boost's original's), newest first window by window, a post named by two
 * labels is offered once, and each row reads `[label]` over the window's
 * title when there is one, the author and the first words.
 */
import { describe, expect, it } from 'vitest';

import { type LabelSource, postLabelProvider } from './postLabelProvider';
import type { AppState } from '../state/appState';
import { activeBuffer } from '../state/selectors';
import { sessionWith } from '../test/completionSessions';
import { status } from '../test/fixtures';

/** The home window of {@link state}, called {@link title}. */
function source(state: AppState, title: string | null): LabelSource {
  return { title, buffer: activeBuffer(state) };
}

/** Three posts, `c` the newest: labelled `a2`, `a1`, `a0`; `b` has a web page. */
function three(): AppState {
  return sessionWith({
    statuses: [status('c'), status('b', { url: 'https://wired.example/@lain/b' }), status('a')],
  });
}

describe('postLabelProvider accepts', () => {
  const provider = postLabelProvider([]);

  it('takes a word typed with a bracket', () => {
    expect(provider.accepts('[', false)).toBe(true);
    expect(provider.accepts('[a3', false)).toBe(true);
    expect(provider.accepts('[a3]', true)).toBe(true);
  });

  it('never takes a bare label, which is too much like an ordinary word', () => {
    expect(provider.accepts('a3', false)).toBe(false);
    expect(provider.accepts('a', true)).toBe(false);
    expect(provider.accepts('', false)).toBe(false);
  });

  it('leaves the other kinds of word to the other providers', () => {
    expect(provider.accepts('@bo', false)).toBe(false);
    expect(provider.accepts('[a3](link)', false)).toBe(false);
  });
});

describe('postLabelProvider candidates', () => {
  it('offers the links of the posts, newest first, the page of a post that has one', () => {
    const provider = postLabelProvider([source(three(), null)]);

    expect(provider.candidates('[')).toStrictEqual([
      'https://wired.example/n/c',
      'https://wired.example/@lain/b',
      'https://wired.example/n/a',
    ]);
  });

  it('narrows to the typed prefix, in any case, brackets or not', () => {
    const provider = postLabelProvider([source(three(), null)]);

    expect(provider.candidates('[a1')).toStrictEqual(['https://wired.example/@lain/b']);
    expect(provider.candidates('[A1]')).toStrictEqual(['https://wired.example/@lain/b']);
    expect(provider.candidates('[z')).toStrictEqual([]);
  });

  it('offers the link of the original under a boost', () => {
    const state = sessionWith({ statuses: [status('r', { reblog: status('orig') })] });

    expect(postLabelProvider([source(state, null)]).candidates('[a0')).toStrictEqual([
      'https://wired.example/n/orig',
    ]);
  });

  it('offers the posts of every window, in the order given, each link once', () => {
    const first = sessionWith({ statuses: [status('x'), status('shared')] });
    const second = sessionWith({ statuses: [status('y'), status('shared')] });
    const provider = postLabelProvider([source(first, 'home'), source(second, 'local')]);

    expect(provider.candidates('[')).toStrictEqual([
      'https://wired.example/n/x',
      'https://wired.example/n/shared',
      'https://wired.example/n/y',
    ]);
  });

  it('offers nothing without a window', () => {
    expect(postLabelProvider([]).candidates('[')).toStrictEqual([]);
  });
});

describe('postLabelProvider describe', () => {
  it('names the label, the window, the author and the first words', () => {
    const provider = postLabelProvider([source(three(), 'home')]);

    expect(provider.describe?.('https://wired.example/@lain/b')).toStrictEqual({
      word: 'https://wired.example/@lain/b',
      label: '[a1]',
      description: 'home <@lain@wired.example> b',
    });
  });

  it('leaves the window out where there is no title', () => {
    const provider = postLabelProvider([source(three(), null)]);

    expect(provider.describe?.('https://wired.example/n/c')?.description).toBe(
      '<@lain@wired.example> c',
    );
  });

  it('puts a content warning in place of the body and marks a boost', () => {
    const state = sessionWith({
      statuses: [status('w', { spoiler_text: 'spoilers' }), status('r', { reblog: status('o') })],
    });
    const provider = postLabelProvider([source(state, 'home')]);

    expect(provider.describe?.('https://wired.example/n/w')?.description).toBe(
      'home <@lain@wired.example> CW: spoilers',
    );
    expect(provider.describe?.('https://wired.example/n/o')?.description).toBe(
      'home ⟲ <@lain@wired.example> o',
    );
  });

  it('says nothing of a link it did not offer', () => {
    const provider = postLabelProvider([source(three(), 'home')]);

    expect(provider.describe?.('https://elsewhere.example/n/1')).toBeUndefined();
  });
});
