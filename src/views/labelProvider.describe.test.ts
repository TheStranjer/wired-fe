/**
 * Tests for the rows the post-label provider describes (WFE-301): the author
 * and the first words of a post as plain text, a content warning in place of
 * the body, a boost under the original's author, a quote under its own label.
 */
import { describe, expect, it } from 'vitest';

import { labelProvider } from './labelProvider';
import type { AppState } from '../state/appState';
import { author, sessionWith } from '../test/completionSessions';
import { status } from '../test/fixtures';

/** The author every fixture post shares. */
const LAIN = '<@lain@wired.example>';

/** Three posts, `a` the oldest: labelled `a0`, `a1`, `a2`. */
function three(extras: Record<string, unknown> = {}): AppState {
  return sessionWith({
    statuses: [status('c', extras), status('b', { content: '<p>second</p>' }), status('a')],
  });
}

/** The provider over {@link state}. */
function over(state: AppState): ReturnType<typeof labelProvider> {
  return labelProvider(state, new Set(['fav']));
}

describe('labelProvider describe', () => {
  it('names the author and the first words of the post as plain text', () => {
    const state = three({ content: '<p>Hello <b>wired</b> &amp; world</p>' });

    expect(over(state).describe?.('a2')).toStrictEqual({
      word: 'a2',
      label: 'a2',
      description: `${LAIN} Hello wired & world`,
    });
  });

  it('keeps the bracket the word was typed with', () => {
    expect(over(three()).describe?.('[a1]')).toStrictEqual({
      word: '[a1]',
      label: '[a1]',
      description: `${LAIN} second`,
    });
  });

  it('cuts long words at forty characters', () => {
    const state = three({ content: `<p>${'x'.repeat(41)}</p>` });

    expect(over(state).describe?.('a2')?.description).toBe(`${LAIN} ${'x'.repeat(40)}…`);
  });

  it('never carries markup out of hostile content', () => {
    const state = three({
      content: '<p>hi</p><script>alert(1)</script><img src=x onerror=alert(1)>',
    });

    expect(over(state).describe?.('a2')?.description).toBe(`${LAIN} hi`);
  });

  it('shows the content warning in place of the body', () => {
    const state = three({ spoiler_text: 'spoilers', content: '<p>the secret</p>' });

    expect(over(state).describe?.('a2')?.description).toBe(`${LAIN} CW: spoilers`);
  });

  it('shows just the author for a post with no words', () => {
    const state = three({ content: '' });

    expect(over(state).describe?.('a2')?.description).toBe(LAIN);
  });

  it('shows the original author of a boost behind a marker', () => {
    const original = status('orig', {
      account: author('rita@r.example'),
      content: '<p>boosted words</p>',
    });
    const state = sessionWith({ statuses: [status('r', { reblog: original })] });

    expect(over(state).describe?.('a0')?.description).toBe('⟲ <@rita@r.example> boosted words');
  });

  it('describes a quote under the label it was given', () => {
    const quoted = status('inner', {
      account: author('carol@q.example'),
      content: '<p>quoted</p>',
    });
    const state = sessionWith({ statuses: [status('p', { quote: quoted })] });

    expect(over(state).describe?.('a1')?.description).toBe('<@carol@q.example> quoted');
  });
});
