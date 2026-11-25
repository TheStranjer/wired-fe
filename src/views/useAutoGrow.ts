/**
 * Lets a textarea grow with its text (WFE-207): the compact composer is one
 * line until the text wraps, then it is as tall as the text needs, up to the
 * `max-height` its stylesheet sets, past which it scrolls. The height is set
 * on the element itself because it is measured, not designed.
 */

import { type RefObject, useLayoutEffect } from 'react';

/**
 * While {@link enabled}, fit {@link ref}'s textarea to {@link text}: collapse
 * it first so a shrinking text can shrink the box, then take the height the
 * text needs.
 */
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  text: string,
  enabled: boolean,
): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || element === null) {
      return;
    }
    element.style.height = 'auto';
    element.style.height = `${String(element.scrollHeight)}px`;
  }, [ref, text, enabled]);
}
