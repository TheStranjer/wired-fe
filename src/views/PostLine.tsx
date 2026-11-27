/**
 * One status as one scrollback entry, seen through its window's account
 * (AGENTS.md "Layout": src/views is the rendering shared by every window).
 * `LineView` draws it for a post line and `NotificationLine` reuses it for a
 * mention, so what an ordinary timeline shows and what a notification shows
 * are the very same thing. The window's resolved `density` (decision 15) picks
 * the rendering: a card by default, the IRC row when the setting or the
 * window's own override says `lines`; `avatars` decides whether a card shows
 * pictures; a direct post's card also names who it is between, and in a DM
 * window sits as a chat bubble (WFE-234, ./dmView). Nothing here holds state: the clock format, the label, the
 * selection and the open content warnings all come from the app state, and a
 * click asks the one reducer for the transition. When the selection moves onto
 * the entry, the view keeps it in view. Clicking the nick opens the author's
 * profile window (WFE-106); a mention or hashtag link in the body opens its
 * profile or tag window the same way (WFE-156, ./openContentLink). A card's `☺`
 * button opens the emoji picker (WFE-265, ./usePostPicker), fed by the window's
 * own account and choosing through the same line runner as the command line.
 * A plain click on an attachment runs `/media <label> <n>` the same way
 * (WFE-264), so it opens in the media window rather than a browser tab.
 */
import { useEffect, useRef } from 'react';
import type { JSX, RefObject } from 'react';

import { usePostActions, type PostActions } from './PostActionsContext';
import {
  cardName,
  dmCardProps,
  sharedPostProps,
  viewerFor,
  type PostLineTarget,
} from './postLineProps';
import { postView } from './postView';
import { usePostConfirm } from './usePostConfirm';
import { usePostPicker } from './usePostPicker';
import { useLocale } from '../i18n/I18nProvider';
import { isAnonKey } from '../state/anonAccount';
import { labelForStatus } from '../state/bufferSelection';
import { bufferFor, displayFor, windowAccountKey } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import type { PostActionLine } from '../ui/postActionTypes';
import { PostCard } from '../ui/PostCard';
import { PostRow } from '../ui/PostRow';

/**
 * Keep an entry the selection just moved onto inside its scrollback, nearest
 * edge so a fully visible one does not jump. jsdom implements no scrollIntoView
 * at all, so the view asks the element whether it has one before calling it.
 */
function scrollRowIntoView(row: HTMLElement | null): void {
  if (row !== null && 'scrollIntoView' in row) {
    row.scrollIntoView({ block: 'nearest' });
  }
}

/** The post's DOM node, which the view keeps in view whenever {@link selected} turns true. */
function useRowRef(selected: boolean): RefObject<HTMLElement | null> {
  const rowRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (selected) {
      scrollRowIntoView(rowRef.current);
    }
  }, [selected]);
  return rowRef;
}

/** The handler of a double-click on the post labelled {@link label}: run `/pop` on it. */
function popOf(actions: PostActions, label: string): () => void {
  return () => {
    actions.run({ line: `/pop ${label}`, prefill: false });
  };
}

/**
 * The handler of a click on attachment `index` (zero-based) of the post labelled
 * {@link label}: run `/media <label> <index + 1>` (WFE-264). The registry having
 * no `/media` leaves it out, so the attachment links stay the browser's.
 */
function openMediaOf(actions: PostActions, label: string): ((index: number) => void) | undefined {
  if (actions.linesFor(label)['media'] === undefined) {
    return undefined;
  }
  return (index) => {
    actions.run({ line: `/media ${label} ${String(index + 1)}`, prefill: false });
  };
}

/**
 * What a press on a card's action bar does: {@link normal}, except on a card of
 * a signed-out window (WFE-340), where it runs its line outright — never a
 * prefill or a confirm dialog — so the command's own refusal answers it.
 */
function pressOf(
  signedOut: boolean,
  normal: (line: PostActionLine) => void,
  actions: PostActions,
): (line: PostActionLine) => void {
  return signedOut
    ? (action) => {
        actions.run({ line: action.line, prefill: false });
      }
    : normal;
}

/** One post: the card or the row its status maps onto, as the window's account sees it. */
export function PostLine(props: PostLineTarget): JSX.Element {
  useLocale();
  const { windowId, status } = props;
  const state = useAppState();
  const buffer = bufferFor(state, windowId);
  const view = postView(status, viewerFor(state, windowId), (id) => labelForStatus(buffer, id));
  const shared = sharedPostProps({ state, go: useAppDispatch() }, props, view);
  const actions = usePostActions();
  const rowRef = useRowRef(shared.selected);
  const picker = usePostPicker(windowAccountKey(state, windowId), shared.label, actions.run);
  const confirm = usePostConfirm(actions, shared.label, view);
  const display = displayFor(state, windowId);
  const signedOut = isAnonKey(windowAccountKey(state, windowId));
  if (display.density === 'lines') {
    return (
      <PostRow
        {...shared}
        author={view.author}
        boostedBy={view.boostedBy}
        onOpenMedia={openMediaOf(actions, shared.label)}
        onPop={popOf(actions, shared.label)}
        ref={rowRef}
      />
    );
  }
  return (
    <>
      <PostCard
        {...shared}
        author={{ ...view.author, ...cardName(status) }}
        boostedBy={view.boostedBy}
        onOpenMedia={openMediaOf(actions, shared.label)}
        onPop={popOf(actions, shared.label)}
        ref={rowRef}
        actionLines={actions.linesFor(shared.label)}
        onAction={pressOf(signedOut, confirm.onAction, actions)}
        reactPicker={picker}
        readOnly={signedOut}
        showAvatar={display.avatars}
        showImages={display.images}
        {...dmCardProps(state, props, view)}
      />
      {confirm.dialog}
    </>
  );
}
