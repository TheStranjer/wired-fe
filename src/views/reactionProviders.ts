/**
 * The one completion rule that depends on the command line (WFE-172): custom
 * emoji are not offered on a `/react` line of an instance that cannot react
 * with them.
 */

import type { CompletionProvider } from './completionProviders';

/** A command line of `/react` or `/unreact`: the only places custom emoji reactions are typed. */
const REACTION_LINE = /^\/(?:react|unreact)(?:\s|$)/iu;

/**
 * {@link provider} that stands aside on a `/react` or `/unreact` line (WFE-172):
 * for an instance without `customEmojiReactions`, completing `:shortcode:`
 * there would offer a reaction the server refuses. Every other line, a post
 * that merely writes an emoji, still completes.
 */
export function withoutReactionWords(provider: CompletionProvider): CompletionProvider {
  return {
    ...provider,
    accepts: (word, isFirstWord, line) =>
      !REACTION_LINE.test(line ?? '') && provider.accepts(word, isFirstWord, line),
  };
}
