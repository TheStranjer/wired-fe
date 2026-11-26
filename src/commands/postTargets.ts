/**
 * Which commands take a post label as their first argument (decision 6,
 * AGENTS.md "Every post has a short label"): the ones that resolve their
 * target through ./targets, a post or the author of one. The completion of
 * post labels (WFE-301) offers them after exactly these commands, and
 * {@link postTargetWords} adds the aliases the registry gives them.
 */

import type { Registry } from './types';

/** Every command whose first argument may be a post label. */
export const POST_TARGET_COMMANDS: readonly string[] = [
  'block',
  'bookmark',
  'boost',
  'copy',
  'delete',
  'edit',
  'fav',
  'follow',
  'media',
  'mute',
  'open',
  'pin',
  'pop',
  'quote',
  'react',
  'reply',
  'select',
  'thread',
  'unblock',
  'unboost',
  'unbookmark',
  'unfav',
  'unfollow',
  'unmute',
  'unpin',
  'unreact',
  'vote',
  'whois',
];

/** The names and aliases {@link registry} knows for the commands of {@link POST_TARGET_COMMANDS}. */
export function postTargetWords(registry: Registry): ReadonlySet<string> {
  const words = new Set<string>();
  for (const definition of registry.commands) {
    if (POST_TARGET_COMMANDS.includes(definition.name)) {
      for (const word of [definition.name, ...(definition.aliases ?? [])]) {
        words.add(word);
      }
    }
  }
  return words;
}
