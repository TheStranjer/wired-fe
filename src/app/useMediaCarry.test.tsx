/**
 * Tests for the command line's media gate (WFE-290): a draft with no pending
 * media goes through untouched, pending media that are all described carry
 * their ids without asking, one without a description is put to the reader's
 * review first, a cancelled review answers cancelled (no error) and puts
 * the typed line back, and a refused description refuses without touching the
 * line.
 */
import { renderHook } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useMediaCarry } from './useMediaCarry';
import { NOT_LOGGED_IN_MESSAGE } from '../lib/refusal';
import { initialAppState } from '../state/appState';
import { COMMAND_LINE_MEDIA } from '../state/composerMedia';
import type { ComposerMedia } from '../state/draft';
import type { ReviewMedia } from '../state/mediaReview';
import { AppStateProvider } from '../state/StateContext';
import { MediaReviewProvider } from '../views/MediaReviewContext';

/** The ready line the command line holds, with {@link description}. */
function held(description: string): ComposerMedia {
  return {
    key: 'k1',
    name: 'cat.png',
    status: 'ready',
    mediaId: '7',
    previewUrl: null,
    description,
    sent: description,
    error: '',
  };
}

/** The gate for a line holding {@link description}, asking {@link review}, and the `setInput` it was given. */
function gate(description: string, review: ReviewMedia) {
  const setInput = vi.fn<(text: string) => void>();
  const initial = {
    ...initialAppState(),
    composerMedia: new Map([[COMMAND_LINE_MEDIA, [held(description)]]]),
  };
  const wrapper = ({ children }: { readonly children: ReactNode }): JSX.Element => (
    <AppStateProvider initial={initial}>
      <MediaReviewProvider review={review}>{children}</MediaReviewProvider>
    </AppStateProvider>
  );
  const { result } = renderHook(
    () => useMediaCarry({ pending: ['7'], text: 'look at this', setInput }),
    { wrapper },
  );
  return { carry: result.current, setInput };
}

describe(useMediaCarry, () => {
  it('carries the pending ids without asking when every attachment is described', async () => {
    const review = vi.fn<ReviewMedia>();
    const { carry, setInput } = gate('a cat', review);

    await expect(carry({ text: 'hi' })).resolves.toStrictEqual({
      kind: 'carried',
      draft: { text: 'hi', mediaIds: ['7'] },
    });

    expect(review).not.toHaveBeenCalled();
    expect(setInput).not.toHaveBeenCalled();
  });

  it('leaves a draft with media of its own alone, and asks nothing', async () => {
    const review = vi.fn<ReviewMedia>();
    const { carry } = gate('', review);

    await expect(carry({ text: 'hi', mediaIds: ['own'] })).resolves.toStrictEqual({
      kind: 'carried',
      draft: { text: 'hi', mediaIds: ['own'] },
    });

    expect(review).not.toHaveBeenCalled();
  });

  it('asks the reader about the line first and carries the ids on Submit', async () => {
    const review = vi.fn<ReviewMedia>().mockResolvedValue(new Map([['k1', '']]));
    const { carry } = gate('', review);

    await expect(carry({ text: 'hi' })).resolves.toStrictEqual({
      kind: 'carried',
      draft: { text: 'hi', mediaIds: ['7'] },
    });

    expect(review).toHaveBeenCalledWith(COMMAND_LINE_MEDIA, [held('')]);
  });

  it('answers cancelled when the review is cancelled, and puts the typed line back', async () => {
    const { carry, setInput } = gate('', vi.fn<ReviewMedia>().mockResolvedValue(null));

    await expect(carry({ text: 'hi' })).resolves.toStrictEqual({
      kind: 'cancelled',
    });

    expect(setInput).toHaveBeenCalledWith('look at this');
  });

  it('refuses when the description cannot be sent, leaving the line alone', async () => {
    const review = vi.fn<ReviewMedia>().mockResolvedValue(new Map([['k1', 'a cat']]));
    const { carry, setInput } = gate('', review);

    await expect(carry({ text: 'hi' })).resolves.toStrictEqual({
      kind: 'refused',
      error: NOT_LOGGED_IN_MESSAGE,
    });

    expect(setInput).not.toHaveBeenCalled();
  });
});
