/**
 * The mapping both post renderings share (decision 15): what a window's app
 * state and one status say about a post, as the props `PostRow` and `PostCard`
 * have in common, plus the author data only the card shows. `PostLine` picks
 * the rendering; this module holds everything that does not depend on the pick.
 * Pure: state and a status in, plain props out.
 */
import { collapsesHeader, recipientsOf } from './dmView';
import { openContentLink } from './openContentLink';
import type { PostView, Viewer } from './postView';
import { viaFor } from './via';
import type { Account } from '../api/schemas/account';
import type { Status } from '../api/schemas/status';
import type { ClickModifiers } from '../lib/clickModifiers';
import { anonOrigin } from '../state/anonAccount';
import type { AppState } from '../state/appState';
import { labelForStatus } from '../state/bufferSelection';
import { clickOpen } from '../state/placementFromClick';
import { profileWindowOpen } from '../state/profileWindow';
import { accountByKey, bufferFor, windowAccountKey } from '../state/selectors';
import type { Dispatch } from '../state/StateContext';
import type { PostCardProps } from '../ui/PostCard';
import type { PostRowProps } from '../ui/PostRow';

/** The viewer of a window's lines: the account it belongs to, or nobody. */
export function viewerFor(state: AppState, windowId: string): Viewer {
  const key = windowAccountKey(state, windowId);
  const account = accountByKey(state, key);
  if (account === null) {
    return { origin: anonOrigin(key) ?? '', accountId: null };
  }
  return { origin: account.origin, accountId: account.accountId };
}

/** The account the row shows as its author: the boosted original's, for a boost. */
function authorOf(status: Status): Account {
  return (status.reblog ?? status).account;
}

/** The window and state a click handler acts for. */
type Acting = { readonly state: AppState; readonly windowId: string };

/**
 * The nick click's move: a handler asking for {@link status}'s author's
 * profile window, owned by the window's own account (src/state/profileWindow)
 * and placed as the click says (src/state/placementFromClick).
 */
function openAuthor(status: Status, acting: Acting, go: Dispatch): (click: ClickModifiers) => void {
  return (click) => {
    const open = profileWindowOpen(
      authorOf(status),
      windowAccountKey(acting.state, acting.windowId),
    );
    go(clickOpen(acting.state.settings, open, click));
  };
}

/** The author's display name as plain text, and the custom emoji it may use. */
export function cardName(status: Status): {
  readonly displayName: string;
  readonly displayNameEmojis: PostCardProps['author']['displayNameEmojis'];
} {
  const { display_name: displayName, emojis } = authorOf(status);
  return {
    displayName,
    displayNameEmojis: emojis.map(({ shortcode, static_url }) => ({ shortcode, url: static_url })),
  };
}

/**
 * The direct-message parts of a card (WFE-234): who the post names, and, in a
 * DM window, how the bubble sits: the viewer's own to the right, and a
 * header-less continuation of the author's run above it.
 */
export function dmCardProps(
  state: AppState,
  target: PostLineTarget,
  view: PostView,
): Pick<PostCardProps, 'recipients' | 'chat'> {
  const { windowId, lineKey, status } = target;
  const inDm = state.windows.windows.some((win) => win.id === windowId && win.ref.kind === 'dm');
  return {
    recipients: recipientsOf(status, viewerFor(state, windowId)),
    chat: inDm
      ? {
          own: view.author.self,
          collapsed: collapsesHeader(bufferFor(state, windowId).lines, lineKey),
        }
      : null,
  };
}

/** What the post's line is for: the window, its buffer key and its status. */
export type PostLineTarget = {
  readonly windowId: string;
  readonly lineKey: string;
  readonly status: Status;
};

/**
 * The props a row and a card have in common, but for who wrote and boosted the
 * post and the row's DOM node: the body, the metadata, the label, the selection
 * and every handler, all asking the one reducer for the move.
 */
export function sharedPostProps(
  app: { readonly state: AppState; readonly go: Dispatch },
  target: PostLineTarget,
  view: PostView,
): Omit<PostRowProps, 'author' | 'boostedBy' | 'onPop' | 'ref'> {
  const { state, go } = app;
  const { windowId, lineKey, status } = target;
  const buffer = bufferFor(state, windowId);
  return {
    autoExpand: state.settings.expandMedia,
    clockFormat: state.settings.clockFormat,
    counts: view.counts,
    contentHtml: view.contentHtml,
    date: view.date,
    edited: view.edited,
    emojis: view.emojis,
    label: labelForStatus(buffer, status.id) ?? '',
    media: view.media,
    mine: view.mine,
    poll: view.poll,
    quote: view.quote,
    reactions: view.reactions,
    replyTo: view.replyTo,
    visibility: view.visibility,
    onContentLink: openContentLink(view.links, windowAccountKey(state, windowId), {
      settings: state.settings,
      go,
    }),
    onSelect: () => {
      go({ type: 'select', windowId, key: lineKey });
    },
    onSelectAuthor: openAuthor(status, { state, windowId }, go),
    onToggleReveal: () => {
      go({ type: 'toggleReveal', windowId, key: lineKey });
    },
    revealed: buffer.revealed.has(lineKey),
    selected: buffer.selectedKey === lineKey,
    sensitive: view.sensitive,
    spoilerText: view.spoilerText,
    via: viaFor(state, windowId, lineKey),
  };
}
