/**
 * Tests for the media-review seam (WFE-290): a tree with no provider lets
 * everything through with the descriptions as they stand, a provider's review
 * is what the hook returns, and the provider renders its children.
 */
import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MediaReviewProvider, useReviewMedia } from './MediaReviewContext';
import type { ComposerMedia } from '../state/draft';
import type { ReviewMedia } from '../state/mediaReview';

/** A ready line with the description {@link description}. */
function line(description: string): ComposerMedia {
  return {
    key: 'k1',
    name: 'a.png',
    status: 'ready',
    mediaId: '1',
    previewUrl: null,
    description,
    error: '',
  };
}

describe(useReviewMedia, () => {
  it('answers with the descriptions as they stand when there is no provider', async () => {
    const { result } = renderHook(() => useReviewMedia());

    await expect(result.current('w1', [line('a cat')])).resolves.toStrictEqual(
      new Map([['k1', 'a cat']]),
    );
  });

  it('returns the review the provider holds', () => {
    const review = vi.fn<ReviewMedia>();
    const { result } = renderHook(() => useReviewMedia(), {
      wrapper: ({ children }) => (
        <MediaReviewProvider review={review}>{children}</MediaReviewProvider>
      ),
    });

    expect(result.current).toBe(review);
  });

  it('renders its children', () => {
    render(
      <MediaReviewProvider review={vi.fn<ReviewMedia>()}>
        <p>inside</p>
      </MediaReviewProvider>,
    );

    expect(screen.getByText('inside')).toBeInTheDocument();
  });
});
