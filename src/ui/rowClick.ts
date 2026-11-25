/**
 * Where a click inside a post row goes: a click (any modifier, primary or
 * middle button) on a link in the body
 * goes to the app when it opens that link itself (a mention or a hashtag), a
 * click on any other control stays with that control, and a click on the rest
 * of the row selects it. A double-click on the rest of the row pops the post
 * out (`/pop`, WFE-241); a double-click on a control leaves it alone. Pure
 * event logic, split out of {@link PostRow} and shared with {@link PostCard}
 * through {@link postArticleProps}.
 */
import type { MouseEvent } from 'react';

import { type ClickModifiers, isMiddleClick } from '../lib/clickModifiers';

/** What a row does with a click: select itself, or open a body link in the app. */
type RowClickHandlers = {
  readonly onSelect: () => void;
  /** True when the app opened {@link href} itself, so the browser must not. */
  readonly onContentLink: (href: string, click: ClickModifiers) => boolean;
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
  /** Called when the row is double-clicked outside its controls: pop the post out. */
  readonly onPop: () => void;
};

/** What the click routing hands back to the `article`: its marks and handlers. */
type PostArticleProps = {
  readonly 'aria-current': 'true' | undefined;
  readonly 'aria-label': string;
  readonly onClickCapture: (event: MouseEvent<HTMLElement>) => void;
  readonly onAuxClickCapture: (event: MouseEvent<HTMLElement>) => void;
  readonly onDoubleClickCapture: (event: MouseEvent<HTMLElement>) => void;
};

/** The controls a click stays with: links, buttons (the nick, the warning toggle) and players. */
const CONTROLS = 'button, a, audio, video';

/**
 * The attributes both a post row and a post card put on their `article`: the
 * selection mark, the accessible name ("Post a3 by …", or "Direct message a3 from …") and the click routing.
 * The click is mouse-only on purpose: keyboard selection lives in the
 * navigation keymap, one action for every post, not a tab stop per post, and
 * the keyboard's pop is the `p` hotkey. The strict jsx-a11y gate reads the
 * onClick name alone, never its semantics, so the same synthetic events are
 * caught in their capture phase.
 */
export function postArticleProps(input: PostArticleInput): PostArticleProps {
  const { label, fullHandle, selected, direct = false, onPop, ...handlers } = input;
  return {
    'aria-current': selected ? 'true' : undefined,
    'aria-label': direct
      ? `Direct message ${label} from ${fullHandle}`
      : `Post ${label} by ${fullHandle}`,
    onClickCapture: (event) => {
      routeRowClick(event, handlers);
    },
    onAuxClickCapture: (event) => {
      offerLink(event, handlers);
    },
    onDoubleClickCapture: (event) => {
      if (controlOf(event, CONTROLS) === null) {
        onPop();
      }
    },
  };
}

/** The element of {@link selector} the event landed in or on, or null for the bare row. */
function controlOf(event: MouseEvent<HTMLElement>, selector: string): Element | null {
  return event.target instanceof Element ? event.target.closest(selector) : null;
}

/**
 * Offer a click on a link to the app, which places the window it opens by the
 * click's modifiers (WFE-238): the default is prevented when the app opened
 * it, so the browser never opens a new tab for an internal link; a link the
 * app does not open, or a button other than the primary and the middle one,
 * is left to the browser.
 */
function offerLink(event: MouseEvent<HTMLElement>, handlers: RowClickHandlers): void {
  const href = controlOf(event, CONTROLS)?.getAttribute('href') ?? null;
  const offered = event.button === 0 || isMiddleClick(event);
  if (href !== null && offered && handlers.onContentLink(href, event)) {
    event.preventDefault();
  }
}

/**
 * Route one click, seen in the row's capture phase: a click on a link the app
 * opens itself is opened there ({@link offerLink}); a click on any other
 * control is left to that control; the rest of the row is selected.
 */
function routeRowClick(event: MouseEvent<HTMLElement>, handlers: RowClickHandlers): void {
  if (controlOf(event, CONTROLS) === null) {
    handlers.onSelect();
  } else {
    offerLink(event, handlers);
  }
}
