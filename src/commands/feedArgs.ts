/**
 * What the `/feed` subcommands share (decision 14): the subcommand words, the
 * usage refusal each of them answers with, reading a feed's name (a leading `~`
 * is the one its window title shows, so it is optional), finding a saved feed
 * by it, reading several source words into references, and saving the changed
 * feed list, which rides out in a `settings` action like every setting.
 */

import { fail } from './outcome';
import type { CommandContext, CommandOutcome } from './types';
import { type Result, err, ok } from '../lib/result';
import { feedByName, type FeedSourceRef, type FeedSpec, type Feeds } from '../state/feeds';
import { parseSource } from '../state/feedSource';

/** The subcommand words, in the order `/help` and completion list them. */
export const FEED_SUBCOMMANDS: readonly string[] = [
  'list',
  'new',
  'add',
  'rm',
  'rename',
  'delete',
  'open',
];

/** The refusal of a subcommand given the wrong words: its form, behind `/feed`. */
export function feedUsage(form: string): CommandOutcome {
  return fail(`Usage: /feed ${form}`);
}

/** {@link word} without the one leading `~` a feed window's title writes before its name. */
export function bareName(word: string): string {
  return word.startsWith('~') ? word.slice(1) : word;
}

/**
 * Why {@link name} cannot name a feed, or null when it can: a subcommand word
 * would make `/feed <name>` open another command.
 */
export function reservedName(name: string): string | null {
  return FEED_SUBCOMMANDS.includes(name.toLowerCase())
    ? `"${name}" is a /feed word; pick another name`
    : null;
}

/** The saved feed {@link word} names, or the message that there is none. */
export function findFeed(context: CommandContext, word: string): Result<FeedSpec, string> {
  const name = bareName(word);
  const feed = feedByName(context.state.settings.feeds, name);
  return feed === undefined ? err(`No feed named "${name}"`) : ok(feed);
}

/** Every word of {@link words} read as source text; the first one that is not a source is the error. */
export function parseSources(
  words: readonly string[],
  context: CommandContext,
): Result<readonly FeedSourceRef[], string> {
  const refs: FeedSourceRef[] = [];
  for (const word of words) {
    const parsed = parseSource(word, context.state.accounts);
    if (!parsed.ok) {
      return parsed;
    }
    refs.push(...parsed.value);
  }
  return ok(refs);
}

/** Save {@link feeds} as the reader's feed list. */
export function saveFeeds(context: CommandContext, feeds: Feeds): void {
  context.dispatch({ type: 'settings', settings: { feeds } });
}

/**
 * The feed and the sources of the words `<name> <source>…` that `add` and `rm`
 * take, or the refusal to answer with: {@link form} as usage when a word is
 * missing, then the unknown feed, then the first word that is not a source.
 */
export function feedAndSources(
  words: readonly string[],
  context: CommandContext,
  form: string,
): Result<{ readonly feed: FeedSpec; readonly refs: readonly FeedSourceRef[] }, CommandOutcome> {
  const [word, ...sources] = words;
  if (word === undefined || sources.length === 0) {
    return err(feedUsage(form));
  }
  const feed = findFeed(context, word);
  if (!feed.ok) {
    return err(fail(feed.error));
  }
  const refs = parseSources(sources, context);
  return refs.ok ? ok({ feed: feed.value, refs: refs.value }) : err(fail(refs.error));
}
