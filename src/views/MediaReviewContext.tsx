/**
 * The seam between a send that carries media and the modal that reviews their
 * alt text first (WFE-290): the composition root provides the function that
 * asks the reader, and the views and features reach it here without importing
 * the app. Without a provider nothing is asked: the media go out as they are.
 */

import { createContext, use } from 'react';
import type { JSX, ReactNode } from 'react';

import type { ReviewMedia } from '../state/mediaReview';

/** What a tree with no provider asks: nothing, and answers with the descriptions as they stand. */
const NO_REVIEW: ReviewMedia = async (_windowId, items) =>
  await Promise.resolve(new Map(items.map((item) => [item.key, item.description])));

const MediaReviewContext = createContext<ReviewMedia>(NO_REVIEW);

/** Put {@link review} in front of {@link children}. */
export function MediaReviewProvider(props: {
  readonly review: ReviewMedia;
  readonly children: ReactNode;
}): JSX.Element {
  return <MediaReviewContext value={props.review}>{props.children}</MediaReviewContext>;
}

/** The review the app lends, or the one that lets everything through. */
export function useReviewMedia(): ReviewMedia {
  return use(MediaReviewContext);
}
