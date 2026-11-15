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
 * never from the boost around it.
 */

import { fullHandle } from '../accounts/handle';
import type { Account } from '../api/schemas/account';
import type { MediaAttachment } from '../api/schemas/mediaAttachment';
import type { Poll } from '../api/schemas/poll';
import type { Reaction } from '../api/schemas/reaction';
import type { Status, Visibility } from '../api/schemas/status';
import type { MediaItem } from '../ui/MediaList';
import type { PollViewData } from '../ui/PollView';

/** Who is looking: the instance origin handles are rendered against, and the
 * id of the active account, or null when nobody is signed in. */
export type Viewer = {
  readonly origin: string;
  readonly accountId: string | null;
};

/** An account's two handle forms: the nick's short form and the @-prefixed
 * full one. */
type Handles = {
  readonly handle: string;
  readonly fullHandle: string;
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
  };
  /** The body as hostile remote HTML; RemoteHtml sanitizes it. */
  readonly contentHtml: string;
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
  /** The emoji reactions on the displayed status: the emoji, its tally, and
   * whether the viewer sent one, in the order the backend sent them. */
  readonly reactions: readonly {
    readonly name: string;
    readonly count: number;
    readonly me: boolean;
  }[];
  /** The poll the displayed status carries, as the row draws it under the
   * body; null when it carries none. */
  readonly poll: PollViewData | null;
};

/** The nick's two forms for an account seen from `origin`. */
function handles(account: Account, origin: string): Handles {
  return { handle: account.acct, fullHandle: `@${fullHandle(account, origin)}` };
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
  return parent === undefined ? 'a thread' : `@${parent.acct}`;
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

/** One reaction without the image url the row does not draw (yet). */
function reactionOf(reaction: Reaction): PostView['reactions'][number] {
  return { name: reaction.name, count: reaction.count, me: reaction.me };
}

/** One attachment in the row's own field names. */
function mediaItem(attachment: MediaAttachment): MediaItem {
  return {
    id: attachment.id,
    type: attachment.type,
    url: attachment.url,
    previewUrl: attachment.preview_url,
    description: attachment.description,
  };
}

/** The displayed status's poll in the row's own field names; null when none. */
function pollOf(poll: Poll | null): PollViewData | null {
  if (poll === null) {
    return null;
  }
  return {
    options: poll.options.map((option) => ({ title: option.title, votes: option.votes_count })),
    totalVotes: poll.votes_count,
    expiresAt: poll.expires_at === null ? null : new Date(poll.expires_at),
    expired: poll.expired,
    multiple: poll.multiple,
    ownVotes: poll.own_votes,
    voted: poll.voted,
  };
}

/**
 * Map a status onto one row's data: a boost shows the reblogged status and
 * names the booster, anything else shows itself with no booster.
 */
export function postView(status: Status, viewer: Viewer): PostView {
  const boosted = status.reblog;
  const shown = boosted ?? status;
  return {
    id: shown.id,
    date: new Date(shown.created_at),
    author: authorOf(shown.account, viewer),
    contentHtml: shown.content,
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
  };
}
