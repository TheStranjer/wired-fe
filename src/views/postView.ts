/**
 * The Status -> PostView mapping the shared line views render (AGENTS.md
 * "Layout": src/views is the rendering shared by every window): it reads api
 * entities and produces the plain data props PostRow takes, since the ui layer
 * never sees API types. Pure: one status and the viewer go in, one immutable
 * view model comes out. A boost displays the original status with the
 * booster's name attached to it, and so does every piece of metadata: the
 * reply it answers, its audience, its counters, the viewer's marks on it, its
 * reactions, its attachments, its poll and its sensitive flag, and whether it was
 * edited all come from the displayed status,
 * never from the boost around it. A quoted post rides along as the excerpt
 * line ui/QuoteBlock draws, mapped in ./quoteView.
 */

import { contentLinks, type ContentLink } from './contentLinks';
import { mediaItem } from './mediaView';
import { pollOf, reactionOf } from './postParts';
import { quoteView, type Handles, type LabelOf, type QuoteView } from './quoteView';
import { fullHandle } from '../accounts/handle';
import type { Account } from '../api/schemas/account';
import type { Status, Visibility } from '../api/schemas/status';
import { t } from '../i18n/translate';
import type { EmojiRef } from '../ui/emojify';
import type { MediaItem } from '../ui/MediaList';
import type { PollViewData } from '../ui/PollView';
import type { PostReaction } from '../ui/ReactionChip';

/** Who is looking: the instance origin handles are rendered against, and the
 * id of the active account, or null when nobody is signed in. */
export type Viewer = {
  readonly origin: string;
  readonly accountId: string | null;
};

/** An account's picture: the (maybe animated) image and its still. Either may
 * be '' when the backend sent none; the Avatar then shows the bundled default. */
type AvatarUrls = {
  readonly src: string;
  readonly staticSrc: string;
};

/** The data props of one PostRow, derived from a single status. */
export type PostView = {
  /** The id of the displayed status (the original, for boosts). */
  readonly id: string;
  /** When the displayed status was created. */
  readonly date: Date;
  /** Who wrote the displayed status, and whether that is the viewer. */
  readonly author: {
    readonly handle: string;
    readonly fullHandle: string;
    readonly self: boolean;
    readonly avatar: AvatarUrls;
  };
  /** The body as hostile remote HTML; RemoteHtml sanitizes it. */
  readonly contentHtml: string;
  /** The links in the body the app opens itself, by the href each is written
   * as: a mention opens a profile window, a hashtag a tag window. */
  readonly links: ReadonlyMap<string, ContentLink>;
  /** The status's own custom emoji, as the row's body renders them inline. */
  readonly emojis: readonly EmojiRef[];
  /** The content warning of the displayed status; '' when there is none. */
  readonly spoilerText: string;
  /** The attachments of the displayed status, as the row's media lines draw
   * them; empty when it carries none. */
  readonly media: readonly MediaItem[];
  /** Whether the author marked the displayed status sensitive; its media then
   * never opens by itself. */
  readonly sensitive: boolean;
  /** Who boosted the displayed status; null when nothing was boosted. */
  readonly boostedBy: {
    readonly handle: string;
    readonly fullHandle: string;
    readonly avatar: AvatarUrls;
  } | null;
  /** Who the displayed status answers, as `@carol`: the mention the backend
   * resolved for it, or `a thread` when it names an account the status does
   * not carry; null when the status answers nobody. */
  readonly replyTo: string | null;
  /** Who could see the displayed status; its glyph follows the body. */
  readonly visibility: Visibility;
  /** Whether the author edited the displayed status after posting it. */
  readonly edited: boolean;
  /** What the backend counted on the displayed status. */
  readonly counts: {
    readonly replies: number;
    readonly boosts: number;
    readonly favourites: number;
  };
  /** Which of those the viewer has already done themselves. */
  readonly mine: {
    readonly boosted: boolean;
    readonly favourited: boolean;
    readonly bookmarked: boolean;
  };
  /** The emoji reactions on the displayed status: the emoji (with its picture
   * when custom), its tally, and whether the viewer sent one, in the order the
   * backend sent them. */
  readonly reactions: readonly PostReaction[];
  /** The poll the displayed status carries, as the row draws it under the
   * body; null when it carries none. */
  readonly poll: PollViewData | null;
  /** The post the displayed status quotes, as the dim ┌ line under the row
   * draws it; null when it quotes nothing. */
  readonly quote: QuoteView | null;
};

/** The account's picture URLs, as the backend sent them. */
function avatarOf(account: Account): AvatarUrls {
  return { src: account.avatar, staticSrc: account.avatar_static };
}

/** The nick's two forms for an account seen from `origin`, with its picture. */
function handles(account: Account, origin: string): Handles & { readonly avatar: AvatarUrls } {
  return {
    handle: account.acct,
    fullHandle: `@${fullHandle(account, origin)}`,
    avatar: avatarOf(account),
  };
}

/** The displayed status's author, flagged when it is the viewer themself. */
function authorOf(account: Account, viewer: Viewer): PostView['author'] {
  return {
    ...handles(account, viewer.origin),
    self: viewer.accountId !== null && account.id === viewer.accountId,
  };
}

/**
 * Who a status answers, in the words the row has room for: the mention whose
 * id the backend named as the parent author, else the thread it belongs to.
 */
function replyTo(status: Status): string | null {
  if (status.in_reply_to_id === null) {
    return null;
  }
  const parent = status.mentions.find((mention) => mention.id === status.in_reply_to_account_id);
  return parent === undefined ? t('views.post.a_thread') : `@${parent.acct}`;
}

/** The tallies the row shows, under the names the row uses. */
function countsOf(status: Status): PostView['counts'] {
  return {
    replies: status.replies_count,
    boosts: status.reblogs_count,
    favourites: status.favourites_count,
  };
}

/** The marks the viewer has left on the status themselves. */
function mineOf(status: Status): PostView['mine'] {
  return {
    boosted: status.reblogged,
    favourited: status.favourited,
    bookmarked: status.bookmarked,
  };
}

/**
 * Map a status onto one row's data: a boost shows the reblogged status and
 * names the booster, anything else shows itself with no booster. `labelOf`
 * gives a quoted status the label its window gave it, null for none.
 */
export function postView(status: Status, viewer: Viewer, labelOf: LabelOf = () => null): PostView {
  const boosted = status.reblog;
  const shown = boosted ?? status;
  return {
    id: shown.id,
    date: new Date(shown.created_at),
    author: authorOf(shown.account, viewer),
    contentHtml: shown.content,
    links: contentLinks(shown),
    emojis: shown.emojis.map(({ shortcode, static_url }) => ({ shortcode, url: static_url })),
    spoilerText: shown.spoiler_text,
    media: shown.media_attachments.map(mediaItem),
    sensitive: shown.sensitive,
    boostedBy: boosted === null ? null : handles(status.account, viewer.origin),
    replyTo: replyTo(shown),
    visibility: shown.visibility,
    edited: shown.edited_at !== null,
    counts: countsOf(shown),
    mine: mineOf(shown),
    reactions: shown.emoji_reactions.map(reactionOf),
    poll: pollOf(shown.poll),
    quote: quoteView(shown.quote, viewer.origin, labelOf),
  };
}
