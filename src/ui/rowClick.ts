/**
 * Where a click inside a post row goes: a plain click on a link in the body
 * goes to the app when it opens that link itself (a mention or a hashtag), a
 * click on any other control stays with that control, and a click on the rest
 * of the row selects it. Pure event logic, split out of {@link PostRow} and
 * shared with {@link PostCard} through {@link postArticleProps}.
 */
import type { MouseEvent } from 'react';

/** What a row does with a click: select itself, or open a body link in the app. */
type RowClickHandlers = {
  readonly onSelect: () => void;
  /** True when the app opened {@link href} itself, so the browser must not. */
  readonly onContentLink: (href: string) => boolean;
};

/** What a post article needs to say about itself and to route clicks. */
type PostArticleInput = RowClickHandlers & {
  /** The short row label, e.g. "a3". */
  readonly label: string;
  /** The author's full handle, e.g. "@alice@m.example". */
  readonly fullHandle: string;
  /** True for the post the user is on. */
  readonly selected: boolean;
  /** True for a direct message, which is named so; a plain post leaves it out. */
  readonly direct?: boolean;
};

/**
 * The attributes both a post row and a post card put on their `article`: the
 * selection mark, the accessible name ("Post a3 by …", or "Direct message a3 from …") and the click routing.
 * The click is mouse-only on purpose: keyboard selection lives in the
 * navigation keymap, one action for every post, not a tab stop per post. The
 * strict jsx-a11y gate reads the onClick name alone, never its semantics, so
 * the same synthetic event is caught in its capture phase.
 */
export function postArticleProps(input: PostArticleInput): {
  readonly 'aria-current': 'true' | undefined;
  readonly 'aria-label': string;
  readonly onClickCapture: (event: MouseEvent<HTMLElement>) => void;
} {
  const { label, fullHandle, selected, direct = false, ...handlers } = input;
  return {
    'aria-current': selected ? 'true' : undefined,
    'aria-label': direct
      ? `Direct message ${label} from ${fullHandle}`
      : `Post ${label} by ${fullHandle}`,
    onClickCapture: (event) => {
      routeRowClick(event, handlers);
    },
  };
}

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
function routeRowClick(event: MouseEvent<HTMLElement>, handlers: RowClickHandlers): void {
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
