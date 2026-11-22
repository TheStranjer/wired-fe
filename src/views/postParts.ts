/**
 * The pieces of a {@link PostView} that are plain field renames of one api
 * entity: a reaction, an attachment and a poll in the names the row uses. Split
 * out of ./postView, which assembles them.
 */

import type { MediaAttachment } from '../api/schemas/mediaAttachment';
import type { Poll } from '../api/schemas/poll';
import type { Reaction } from '../api/schemas/reaction';
import type { MediaItem } from '../ui/MediaList';
import type { PollViewData } from '../ui/PollView';

/** One reaction without the image url the row does not draw (yet). */
export function reactionOf(reaction: Reaction): {
  readonly name: string;
  readonly count: number;
  readonly me: boolean;
} {
  return { name: reaction.name, count: reaction.count, me: reaction.me };
}

/** One attachment in the row's own field names. */
export function mediaItem(attachment: MediaAttachment): MediaItem {
  return {
    id: attachment.id,
    type: attachment.type,
    url: attachment.url,
    previewUrl: attachment.preview_url,
    description: attachment.description,
  };
}

/** The displayed status's poll in the row's own field names; null when none. */
export function pollOf(poll: Poll | null): PollViewData | null {
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
