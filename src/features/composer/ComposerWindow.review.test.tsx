/**
 * Tests for the review of alt text before a composer window sends (WFE-290):
 * an attachment without a description puts the window's media to the review
 * first and the post waits; what the review answers is put to the instance
 * before the post, which then goes out once; cancelling it posts nothing and
 * keeps the text and the attachments; described media send with no review.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { WIRED, openedComposer } from './composerSession';
import { ComposerWindow } from './ComposerWindow';
import { acceptingUploads, attachment, choose, picture } from './mediaHarness';
import type { ReviewMedia } from '../../state/mediaReview';
import { AppStateProvider } from '../../state/StateContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { MediaReviewProvider } from '../../views/MediaReviewContext';

/** A review whose reader types {@link description} for every line and submits. */
function typing(description: string): ReviewMedia {
  return async (_windowId, items) =>
    await Promise.resolve(new Map(items.map((item) => [item.key, description])));
}

/** Answer the alt-text put and the create, recording what arrived. */
function recording(): string[] {
  const calls: string[] = [];
  server.use(
    http.put(`${WIRED}/api/v1/media/:id`, async ({ params, request }) => {
      const body = (await request.json()) as { readonly description: string };
      calls.push(`put ${String(params['id'])} ${body.description}`);
      return HttpResponse.json(attachment(String(params['id'])));
    }),
    http.post(`${WIRED}/api/v1/statuses`, () => {
      calls.push('post');
      return HttpResponse.json(status('9'));
    }),
  );
  return calls;
}

/** Show the first composer window, asking {@link review} before it sends media, with cat.png attached and the text `look` written. */
async function readyToSend(review: ReviewMedia): Promise<void> {
  const state = openedComposer();
  render(
    <AppStateProvider initial={state}>
      <MediaReviewProvider review={review}>
        <ComposerWindow windowId={state.windows.activeId} />
      </MediaReviewProvider>
    </AppStateProvider>,
  );
  choose([picture('cat.png')]);
  await screen.findByText('ready');
  fireEvent.change(screen.getByRole('textbox', { name: 'Post text' }), {
    target: { value: 'look' },
  });
}

/** Press `[ send ]`. */
function send(): void {
  fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));
}

describe('reviewing the alt text of the composer window', () => {
  it('waits for the review, then describes with its answer and posts once', async () => {
    server.use(acceptingUploads());
    const calls = recording();
    const review = vi.fn<ReviewMedia>(typing('a grey cat'));
    await readyToSend(review);

    send();
    await screen.findByText(/Posted as/u);

    expect(review).toHaveBeenCalledTimes(1);
    expect(calls).toStrictEqual(['put m1 a grey cat', 'post']);
  });

  it('posts nothing and keeps the text and the attachments when the review is cancelled', async () => {
    server.use(acceptingUploads());
    const calls = recording();
    const review = vi.fn<ReviewMedia>().mockResolvedValue(null);
    await readyToSend(review);

    send();
    await waitFor(() => {
      expect(review).toHaveBeenCalledTimes(1);
    });

    expect(calls).toStrictEqual([]);
    expect(screen.getByRole('textbox', { name: 'Post text' })).toHaveValue('look');
    expect(screen.getByRole('textbox', { name: 'Description for cat.png' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[ send ]' })).toBeEnabled();
  });

  it('posts described media without a review', async () => {
    server.use(acceptingUploads());
    const calls = recording();
    const review = vi.fn<ReviewMedia>();
    await readyToSend(review);
    fireEvent.change(screen.getByRole('textbox', { name: 'Description for cat.png' }), {
      target: { value: 'a grey cat' },
    });

    send();
    await screen.findByText(/Posted as/u);

    expect(review).not.toHaveBeenCalled();
    expect(calls).toStrictEqual(['put m1 a grey cat', 'post']);
  });
});
