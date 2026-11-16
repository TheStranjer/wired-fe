/**
 * Tests for the composer box: it opens on the given text and counts against
 * the given limit, the counter and the send button refuse an empty or
 * over-long draft, Ctrl+Enter and the button hand the built draft over and
 * the box closes when the send answers null, an error string comes back shown
 * inside the box with the text kept for a retry, a plain Enter only types,
 * and the select offers `local` only when the instance serves it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { Composer } from './Composer';
import type { ComposerProps } from './Composer';
import type { Draft } from '../state/draft';

/** The composer's two seams, recorded for the assertions. */
type Seams = {
  readonly onSubmit: ComposerProps['onSubmit'];
  readonly onClose: Mock<ComposerProps['onClose']>;
  readonly drafts: Draft[];
};

/** Spies for both seams: sends record the draft and resolve to {@link error}. */
function seams(error: string | null = null): Seams {
  const drafts: Draft[] = [];
  return {
    onSubmit: async (draft: Draft) => {
      drafts.push(draft);
      return await Promise.resolve(error);
    },
    onClose: vi.fn(),
    drafts,
  };
}

/** Renders one composer with {@link overrides} over the ten-character default. */
function show(overrides: Partial<ComposerProps> = {}): Seams {
  const spies = seams();
  const props: ComposerProps = {
    initialText: '',
    maxCharacters: 10,
    allowLocal: false,
    defaultVisibility: 'public',
    onSubmit: spies.onSubmit,
    onClose: spies.onClose,
    ...overrides,
  };
  render(<Composer {...props} />);
  return spies;
}

/** The post textarea. */
function postText(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

/** Type {@link text} into the post textarea. */
function typeText(text: string): void {
  fireEvent.change(postText(), { target: { value: text } });
}

/** The send button. */
function sendButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: '[ send ]' });
}

/** Press Ctrl+Enter on the post textarea. */
function pressCtrlEnter(): void {
  fireEvent.keyDown(postText(), { key: 'Enter', ctrlKey: true });
}

describe(Composer, () => {
  it('opens on the given text and counts it against the limit', () => {
    show({ initialText: 'hello lain' });

    expect(postText()).toHaveValue('hello lain');
    expect(screen.getByText('10/10')).toBeInTheDocument();
  });

  it('the counter follows what is typed', () => {
    show({ initialText: 'hi' });

    typeText('hello there');

    expect(screen.getByText('11/10')).toBeInTheDocument();
    expect(screen.queryByText('2/10')).toBeNull();
  });

  it('refuses to send an empty or blank draft', () => {
    const spies = show();

    expect(sendButton()).toBeDisabled();

    fireEvent.click(sendButton());
    typeText('   ');
    pressCtrlEnter();

    expect(spies.drafts).toStrictEqual([]);
    expect(spies.onClose).not.toHaveBeenCalled();
  });

  it('refuses to send past the limit', () => {
    const spies = show({ initialText: 'eleven chars!' });

    fireEvent.click(sendButton());
    pressCtrlEnter();

    expect(screen.getByText('13/10')).toBeInTheDocument();
    expect(spies.drafts).toStrictEqual([]);
  });

  it('sends at the limit itself: over means past it', async () => {
    const spies = show({ initialText: 'exactlyten' });

    expect(sendButton()).toBeEnabled();

    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(spies.drafts).toHaveLength(1);
    });
  });

  it('sends on Ctrl+Enter and closes on success', async () => {
    const spies = show({ initialText: 'a long lament', maxCharacters: 500 });

    pressCtrlEnter();

    await waitFor(() => {
      expect(spies.onClose).toHaveBeenCalledTimes(1);
    });

    expect(spies.drafts).toStrictEqual([{ text: 'a long lament', visibility: 'public' }]);
  });

  it('sends what the fields hold: warning and audience included', async () => {
    const spies = show({ initialText: 'spine', defaultVisibility: 'unlisted' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Content warning' }), {
      target: { value: 'needles' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Visibility' }), {
      target: { value: 'direct' },
    });
    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(spies.drafts).toHaveLength(1);
    });

    expect(spies.drafts[0]).toStrictEqual({
      text: 'spine',
      spoilerText: 'needles',
      visibility: 'direct',
    });
  });

  it('shows what the send answered and keeps the draft for a retry', async () => {
    const failing: ComposerProps['onSubmit'] = async () =>
      await Promise.resolve('the server said no');
    const spies = show({ initialText: 'again', onSubmit: failing });

    fireEvent.click(sendButton());

    const error = await screen.findByText('the server said no');

    expect(error).toBeInTheDocument();
    expect(spies.onClose).not.toHaveBeenCalled();
    expect(postText()).toHaveValue('again');

    await waitFor(() => {
      expect(sendButton()).toBeEnabled();
    });
  });

  it('reports a throw from the send the same way', async () => {
    const exploding: ComposerProps['onSubmit'] = async () =>
      await Promise.reject(new Error('kaboom'));
    show({ initialText: 'oops', onSubmit: exploding });

    fireEvent.click(sendButton());

    const error = await screen.findByText('kaboom');

    expect(error).toBeInTheDocument();
  });

  it('leaves a plain Enter to the textarea', () => {
    const spies = show({ initialText: 'two\nlines' });

    fireEvent.keyDown(postText(), { key: 'Enter' });

    expect(spies.drafts).toStrictEqual([]);
  });

  it('offers the local audience only when the instance serves it', () => {
    show();

    expect(screen.queryByRole('option', { name: 'local' })).toBeNull();
  });

  it('lists local when the instance serves it, and sends it', async () => {
    const spies = show({ allowLocal: true, initialText: 'here' });
    const audience = screen.getByRole('combobox', { name: 'Visibility' });

    expect(screen.getByRole('option', { name: 'local' })).toBeInTheDocument();

    fireEvent.change(audience, { target: { value: 'local' } });
    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(spies.drafts).toHaveLength(1);
    });

    expect(spies.drafts[0]?.visibility).toBe('local');
  });

  it('starts the select on the reader default audience', () => {
    show({ defaultVisibility: 'private' });

    expect(screen.getByRole('combobox', { name: 'Visibility' })).toHaveValue('private');
  });

  it('ignores a select change to something it never offered', async () => {
    const spies = show({ allowLocal: false, initialText: 'hi' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Visibility' }), {
      target: { value: 'audience-of-the-moon' },
    });
    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(spies.drafts).toHaveLength(1);
    });

    expect(spies.drafts[0]?.visibility).toBe('public');
  });
});
