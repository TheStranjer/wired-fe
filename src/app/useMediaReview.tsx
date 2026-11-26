/**
 * The modal that reviews alt text before a send goes out (WFE-290): the
 * {@link ReviewMedia} the views and features reach through
 * src/views/MediaReviewContext, and the dialog it opens. Asking opens the
 * {@link MediaReviewDialog} (portalled to the body, outside any live log
 * region) and the answer waits for the reader: `Submit` resolves to the
 * descriptions, `Cancel` and Escape to null. Either way what was typed is
 * written back to the lines of the box they belong to, so a cancelled send
 * keeps it. Root renders the dialog the hook hands back.
 */

import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';

import type { ComposerMedia } from '../state/draft';
import type { ReviewMedia } from '../state/mediaReview';
import { useAppDispatch } from '../state/StateContext';
import { MediaReviewDialog } from '../ui/MediaReviewDialog';

/** The answer a review waits for: the descriptions by line key, or null for cancelled. */
type Answer = ReadonlyMap<string, string> | null;

/** A review under way: whose media, which lines, and how to answer it. */
type Pending = {
  readonly windowId: string;
  readonly items: readonly ComposerMedia[];
  readonly resolve: (answer: Answer) => void;
};

/** What Root needs: the function that asks, and the dialog while one is open. */
export type MediaReview = {
  readonly review: ReviewMedia;
  readonly dialog: JSX.Element | null;
};

/** The review of the app: ask with `review`, render `dialog`. */
export function useMediaReview(): MediaReview {
  const dispatch = useAppDispatch();
  const [pending, setPending] = useState<Pending | null>(null);
  const review = useCallback<ReviewMedia>(
    async (windowId, items) =>
      await new Promise<Answer>((resolve) => {
        setPending({ windowId, items, resolve });
      }),
    [],
  );
  if (pending === null) {
    return { review, dialog: null };
  }
  /** Close the box, keep what was typed on the lines, and answer. */
  const close = (typed: ReadonlyMap<string, string>, answer: Answer): void => {
    setPending(null);
    for (const [key, description] of typed) {
      dispatch({
        type: 'composerMediaPatch',
        windowId: pending.windowId,
        key,
        patch: { description },
      });
    }
    pending.resolve(answer);
  };
  const dialog = createPortal(
    <MediaReviewDialog
      items={pending.items}
      onCancel={(typed) => {
        close(typed, null);
      }}
      onSubmit={(typed) => {
        close(typed, typed);
      }}
    />,
    document.body,
  );
  return { review, dialog };
}
