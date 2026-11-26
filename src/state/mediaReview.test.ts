/**
 * Tests for the review gate of a send that carries media (WFE-290):
 * `needsReview` is true only when a ready attachment has a blank description
 * (nothing at all, or whitespace), `withDescriptions` writes the answers onto
 * the lines they name, and `reviewed` asks only when a review is due, asks
 * about the ready lines of the box, and hands back the lines as the reader left
 * them — or null when they cancelled.
 */
import { describe, expect, it, vi } from 'vitest';

import type { ComposerMedia } from './draft';
import { type ReviewMedia, needsReview, reviewed, withDescriptions } from './mediaReview';

/** A line named {@link key}, ready unless {@link status} says otherwise. */
function line(
  key: string,
  description: string,
  status: ComposerMedia['status'] = 'ready',
): ComposerMedia {
  return {
    key,
    name: `${key}.png`,
    status,
    mediaId: status === 'ready' ? key : null,
    previewUrl: null,
    description,
    error: '',
  };
}

describe(needsReview, () => {
  it('is false for no media', () => {
    expect(needsReview([])).toBe(false);
  });

  it('is false when every ready attachment is described', () => {
    expect(needsReview([line('a', 'a cat'), line('b', 'a dog')])).toBe(false);
  });

  it('is true when one ready attachment has no description', () => {
    expect(needsReview([line('a', 'a cat'), line('b', '')])).toBe(true);
  });

  it('counts whitespace only as no description', () => {
    expect(needsReview([line('a', ' \n\t ')])).toBe(true);
  });

  it('ignores lines that are not ready', () => {
    expect(needsReview([line('a', '', 'uploading'), line('b', '', 'failed')])).toBe(false);
  });
});

describe(withDescriptions, () => {
  it('writes the description of each line it names and leaves the others', () => {
    const result = withDescriptions([line('a', ''), line('b', 'kept')], new Map([['a', 'new']]));

    expect(result.map((item) => item.description)).toStrictEqual(['new', 'kept']);
  });
});

describe(reviewed, () => {
  it('asks nothing and returns the lines when all are described', async () => {
    const review = vi.fn<ReviewMedia>();
    const items = [line('a', 'a cat')];

    await expect(reviewed(review, 'w1', items)).resolves.toBe(items);

    expect(review).not.toHaveBeenCalled();
  });

  it('asks about the ready lines of the box and applies the answer', async () => {
    const review = vi.fn<ReviewMedia>().mockResolvedValue(new Map([['a', 'typed']]));
    const items = [line('a', ''), line('b', '', 'failed')];

    const result = await reviewed(review, 'w1', items);

    expect(review).toHaveBeenCalledWith('w1', [items[0]]);
    expect(result?.map((item) => item.description)).toStrictEqual(['typed', '']);
  });

  it('is null when the reader cancelled', async () => {
    const review = vi.fn<ReviewMedia>().mockResolvedValue(null);

    await expect(reviewed(review, 'w1', [line('a', '')])).resolves.toBeNull();
  });
});
