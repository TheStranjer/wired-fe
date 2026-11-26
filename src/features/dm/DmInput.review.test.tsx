/**
 * Tests for the review of alt text before a DM box sends (WFE-290): an
 * attachment without a description puts the box's media to the review first
 * and the send waits; what the review answers is put to the instance before the
 * post, which then goes out once; cancelling it posts nothing and keeps the
 * text and the rows; described media send with no review.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { DmInput } from './DmInput';
import type { ReviewMedia } from '../../state/mediaReview';
import { AppStateProvider } from '../../state/StateContext';
import { choose, fileInput, picture, ready, servingUploads } from '../../test/attachmentHarness';
import { ALICE_THREAD, ORIGIN, dmState, showing } from '../../test/dmWindow';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { MediaReviewProvider } from '../../views/MediaReviewContext';
import { activeWindow } from '../../windows/model';

/** The box over the conversation, asking {@link review} before it sends media. */
function renderBox(review: ReviewMedia): HTMLElement {
  const state = showing(dmState(), ALICE_THREAD.toReversed());
  return render(
    <AppStateProvider initial={state}>
      <MediaReviewProvider review={review}>
        <DmInput win={activeWindow(state.windows)} />
      </MediaReviewProvider>
    </AppStateProvider>,
  ).container;
}

/** A review whose reader types {@link description} for every line and submits. */
function typing(description: string): ReviewMedia {
  return async (_windowId, items) =>
    await Promise.resolve(new Map(items.map((item) => [item.key, description])));
}

/** Answer the alt-text put and the create, recording what arrived. */
function recording(): string[] {
  const calls: string[] = [];
  server.use(
    http.put(`${ORIGIN}/api/v1/media/:id`, async ({ params, request }) => {
      const body = (await request.json()) as { readonly description: string };
      calls.push(`put ${String(params['id'])} ${body.description}`);
      return HttpResponse.json(ready(String(params['id'])));
    }),
    http.post(`${ORIGIN}/api/v1/statuses`, () => {
      calls.push('post');
      return HttpResponse.json(status('42', { visibility: 'direct' }));
    }),
  );
  return calls;
}

/** Attach cat.png and wait for its row to be ready. */
async function attached(container: HTMLElement): Promise<void> {
  choose(fileInput(container), [picture('cat.png')]);
  await screen.findByText('ready');
}

/** Write {@link text} in the box and press Enter. */
function say(text: string): void {
  const box = screen.getByRole('textbox', { name: 'Post text' });
  fireEvent.change(box, { target: { value: text } });
  fireEvent.keyDown(box, { key: 'Enter' });
}

describe('reviewing the alt text of the DM box', () => {
  it('waits for the review, then describes with its answer and posts once', async () => {
    servingUploads();
    const calls = recording();
    const review = vi.fn<ReviewMedia>(typing('a grey cat'));
    const container = renderBox(review);
    await attached(container);

    say('look');
    await screen.findByText('0/500');

    expect(review).toHaveBeenCalledTimes(1);
    expect(calls).toStrictEqual(['put 1 a grey cat', 'post']);
    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });

  it('posts nothing and keeps the text and the rows when the review is cancelled', async () => {
    servingUploads();
    const calls = recording();
    const review = vi.fn<ReviewMedia>().mockResolvedValue(null);
    const container = renderBox(review);
    await attached(container);

    say('look');
    await waitFor(() => {
      expect(review).toHaveBeenCalledTimes(1);
    });

    expect(calls).toStrictEqual([]);
    expect(screen.getByRole('textbox', { name: 'Post text' })).toHaveValue('look');
    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('cat.png');
  });

  it('sends described media without a review', async () => {
    servingUploads();
    const calls = recording();
    const review = vi.fn<ReviewMedia>();
    const container = renderBox(review);
    await attached(container);
    fireEvent.change(screen.getByRole('textbox', { name: 'Description for cat.png' }), {
      target: { value: 'a grey cat' },
    });

    say('look');
    await screen.findByText('0/500');

    expect(review).not.toHaveBeenCalled();
    expect(calls).toStrictEqual(['put 1 a grey cat', 'post']);
  });
});
