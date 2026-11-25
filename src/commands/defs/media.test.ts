/**
 * Tests for /media: a label or the navigation selection and an attachment
 * number open that attachment's media window as a float by default, `--in`
 * places it elsewhere, a boost shows its original, and a post with no
 * attachments, an index out of range or a bad index is refused with no window
 * asked for. The definition declares the grammar and the navigation `v` binding.
 */
import { describe, expect, it } from 'vitest';

import { command } from './media';
import { accountKey } from '../../accounts/accountStore';
import { bufferFor } from '../../state/selectors';
import { fakeCommandContext } from '../../test/commandContext';
import { status } from '../../test/fixtures';
import { homeContext, ORIGIN } from '../../test/homeWindow';
import { EMPTY_LABEL_BOOK } from '../../windows/labels';

const LAIN_KEY = accountKey(ORIGIN, '1');

/** A wire attachment of the image kind. */
function image(id: string): Record<string, unknown> {
  return { id, type: 'image', url: `https://wired.example/${id}.png` };
}

/** A post with two attachments, which the home window labels a0. */
const TWO = status('p', { media_attachments: [image('m1'), image('m2')] });

/** The ask to open attachment {@link n} of {@link TWO}. */
function openTwo(n: number): unknown {
  return {
    type: 'open',
    ref: { kind: 'media', accountKey: LAIN_KEY, target: `p:${String(n)}` },
    title: `media [a0] ${String(n)}/2`,
  };
}

describe('/media', () => {
  it('opens the first attachment of the post a label names, as a float', async () => {
    const context = homeContext([TWO]);

    await expect(command.run('a0', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'openPlaced',
      action: openTwo(1),
      placement: 'float',
    });
  });

  it('opens the attachment a number names', async () => {
    const context = homeContext([TWO]);

    await expect(command.run('a0 2', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'openPlaced',
      action: openTwo(2),
      placement: 'float',
    });
  });

  it('opens the selected post when only a number is given', async () => {
    const context = homeContext([TWO], 'p');

    await expect(command.run('2', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'openPlaced',
      action: openTwo(2),
      placement: 'float',
    });
  });

  it('opens the first attachment of the selected post with no arguments', async () => {
    const context = homeContext([TWO], 'p');

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'openPlaced',
      action: openTwo(1),
      placement: 'float',
    });
  });

  it('splits when --in says so', async () => {
    const context = homeContext([TWO]);

    await expect(command.run('a0 2 --in vsplit', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'openPlaced',
      action: openTwo(2),
      placement: 'vsplit',
    });
  });

  it('opens in place with --in here', async () => {
    const context = homeContext([TWO]);

    await expect(command.run('a0 --in here', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatchWindows).toHaveBeenCalledWith(openTwo(1));
  });

  it('shows the original of a boost, titled after the boost line', async () => {
    const context = homeContext([status('b', { reblog: TWO })], 'b');

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'openPlaced',
      action: openTwo(1),
      placement: 'float',
    });
  });

  it('leaves the label out of the title when the window has none for the post', async () => {
    const base = homeContext([TWO], 'p');
    const id = base.state.windows.activeId;
    const buffers = new Map(base.state.buffers).set(id, {
      ...bufferFor(base.state, id),
      labels: EMPTY_LABEL_BOOK,
    });
    const context = { ...base, state: { ...base.state, buffers } };

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'openPlaced',
      action: {
        type: 'open',
        ref: { kind: 'media', accountKey: LAIN_KEY, target: 'p:1' },
        title: 'media 1/2',
      },
      placement: 'float',
    });
  });

  it('refuses a post with no attachments', async () => {
    const context = homeContext([status('p')]);

    await expect(command.run('a0', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Post [a0] has no attachments',
    });

    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses an index past the last attachment, naming how many there are', async () => {
    const context = homeContext([TWO]);

    await expect(command.run('a0 3', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Post [a0] has 2 attachments',
    });

    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('says attachment in the singular for a post with one', async () => {
    const context = homeContext([status('p', { media_attachments: [image('m1')] })]);

    await expect(command.run('a0 2', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Post [a0] has 1 attachment',
    });
  });

  it.each(['0', 'x', '1.5', '-1', '1 2'])('refuses %j as an index with the usage', async (text) => {
    const context = homeContext([TWO]);

    await expect(command.run(`a0 ${text}`, context)).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /media [label] [n]',
    });

    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('refuses with nothing selected', async () => {
    const context = homeContext([TWO]);

    await expect(command.run('', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Select a post first (j/k) or give a label',
    });
  });

  it('refuses while nobody is signed in', async () => {
    const context = fakeCommandContext();

    await expect(command.run('a0', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Not logged in. Type /connect',
    });
  });

  it('is /media, bound to navigation v', () => {
    expect(command.name).toBe('media');
    expect(command.aliases).toBeUndefined();
    expect(command.usage).toBe('/media [label] [n]');
    expect(command.bindings).toStrictEqual([{ mode: 'navigation', chord: 'v', args: '{label}' }]);
  });
});
