/**
 * Where a click inside a post row goes: a plain click on a link in the body
 * goes to the app when it opens that link itself (a mention or a hashtag), a
 * click on any other control stays with that control, and a click on the rest
 * of the row selects it. Pure event logic, split out of {@link PostRow}.
 */
import type { MouseEvent } from 'react';

/** What a row does with a click: select itself, or open a body link in the app. */
export type RowClickHandlers = {
  readonly onSelect: () => void;
  /** True when the app opened {@link href} itself, so the browser must not. */
  readonly onContentLink: (href: string) => boolean;
};

/** True for the primary button with no modifier: the click that follows a
 * link in this page, where the others open it in a new tab or window. */
function isPlain(event: MouseEvent<HTMLElement>): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

/**
 * Route one click, seen in the row's capture phase: a plain click on a link the
 * app opens itself is opened there and its default prevented; a modifier or
 * non-primary click on a link is left to the browser; a click on any other
 * control is left to that control; the rest of the row is selected.
 */
export function routeRowClick(event: MouseEvent<HTMLElement>, handlers: RowClickHandlers): void {
  const control =
    event.target instanceof Element ? event.target.closest('button, a, audio, video') : null;
  if (control === null) {
    handlers.onSelect();
    return;
  }
  const href = control.getAttribute('href');
  if (href !== null && isPlain(event) && handlers.onContentLink(href)) {
    event.preventDefault();
  }
}
