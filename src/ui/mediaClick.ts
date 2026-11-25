/**
 * The click handler of an attachment's link (WFE-264): a plain primary click
 * asks the app to open the attachment in its media window instead of letting
 * the browser leave for the raw file, while a middle click or one with a
 * modifier key held reaches the link's `href` natively. Pure event logic
 * shared by {@link MediaTile} and {@link MediaList}.
 */
import type { MouseEvent } from 'react';

import { isPlainClick } from '../lib/plainClick';

/** What the app does to open the attachment at a zero-based index. */
export type OpenMedia = (index: number) => void;

/**
 * The `onClick` of the link of attachment {@link index}, or undefined when
 * there is no {@link open}, which leaves the link to the browser entirely.
 */
export function mediaClick(
  open: OpenMedia | undefined,
  index: number,
): ((event: MouseEvent<HTMLElement>) => void) | undefined {
  if (open === undefined) {
    return undefined;
  }
  return (event) => {
    if (isPlainClick(event)) {
      event.preventDefault();
      open(index);
    }
  };
}
