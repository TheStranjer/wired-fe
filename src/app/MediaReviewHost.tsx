/**
 * Lends the review of alt text before a send (WFE-290) to everything under it:
 * the composition root wraps the app in this, and every send path that carries
 * media asks through src/views/MediaReviewContext. The dialog it opens is
 * rendered beside the children.
 */

import type { JSX, ReactNode } from 'react';

import { useMediaReview } from './useMediaReview';
import { MediaReviewProvider } from '../views/MediaReviewContext';

/** Provides the review to {@link children} and renders its dialog while one is open. */
export function MediaReviewHost(props: { readonly children: ReactNode }): JSX.Element {
  const { review, dialog } = useMediaReview();
  return (
    <MediaReviewProvider review={review}>
      {props.children}
      {dialog}
    </MediaReviewProvider>
  );
}
