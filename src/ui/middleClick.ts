/**
 * The middle button on a control (WFE-238): a browser reports it as an
 * auxiliary click, never a `click`, so a control that opens a window by click
 * listens for both. {@link onMiddleClick} is the `onAuxClick` of such a control.
 */
import type { MouseEvent } from 'react';

import { type ClickModifiers, isMiddleClick } from '../lib/clickModifiers';

/**
 * An `onAuxClick` handler that calls {@link handler} with the click when it
 * is the middle button's, taking the browser's own behaviour (autoscroll, a
 * new tab) off it; the other auxiliary buttons are left alone.
 */
export function onMiddleClick(
  handler: (click: ClickModifiers) => void,
): (event: MouseEvent<HTMLElement>) => void {
  return (event) => {
    if (isMiddleClick(event)) {
      event.preventDefault();
      handler(event);
    }
  };
}
