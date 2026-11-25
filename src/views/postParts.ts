/**
 * The pieces of a {@link PostView} that are plain field renames of one api
 * entity: a reaction, an attachment and a poll in the names the row uses. Split
 * out of ./postView, which assembles them.
 */

import type { Poll } from '../api/schemas/poll';
import type { Reaction } from '../api/schemas/reaction';
import type { PollViewData } from '../ui/PollView';
import type { PostReaction } from '../ui/ReactionChip';

/** One reaction in the row's names, with the picture of a custom emoji. */
export function reactionOf(reaction: Reaction): PostReaction {
  return { name: reaction.name, count: reaction.count, me: reaction.me, url: reaction.url };
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
