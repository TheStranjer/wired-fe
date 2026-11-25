/**
 * The `/feed` subcommands that change what a feed reads (decision 14): `new`
 * saves a feed with its first sources (bare, it opens the editor of a new
 * feed), `add` reads more, `rm` stops reading some. Sources are the command grammar of src/state/feedSource, so `*:home`
 * names the stream for every signed-in account. Each handler takes the words
 * after its subcommand and refuses with a message, changing nothing, when they
 * are wrong.
 */

import { bareName, feedAndSources, parseSources, reservedName, saveFeeds } from './feedArgs';
import { OK, fail } from './outcome';
import type { CommandContext, CommandOutcome } from './types';
import { type Result, err, ok } from '../lib/result';
import { feedEditorOpen } from '../state/feedEditorWindow';
import { nextFeedId } from '../state/feedId';
import { type FeedSpec, addFeed, addSource, removeSource } from '../state/feeds';

/** The feed `new` makes of the name word {@link word} and the source words {@link sources}, or why not. */
function newFeedSpec(
  word: string,
  sources: readonly string[],
  context: CommandContext,
): Result<FeedSpec, string> {
  const name = bareName(word);
  const reserved = reservedName(name);
  if (reserved !== null) {
    return err(reserved);
  }
  const refs = parseSources(sources, context);
  if (!refs.ok) {
    return refs;
  }
  return ok({ id: nextFeedId(context.state.settings.feeds), name, sources: refs.value });
}

/** `new <name> <source>…`: save a feed with those sources; with no words, open the editor of a new feed. */
export function feedNew(words: readonly string[], context: CommandContext): CommandOutcome {
  const [word, ...sources] = words;
  if (word === undefined) {
    context.dispatchWindows(feedEditorOpen(null));
    return OK;
  }
  const spec = newFeedSpec(word, sources, context);
  if (!spec.ok) {
    return fail(spec.error);
  }
  const added = addFeed(context.state.settings.feeds, spec.value);
  if (!added.ok) {
    return fail(added.error);
  }
  saveFeeds(context, added.value);
  context.print(`Made ~${spec.value.name}`);
  return OK;
}

/** `add <name> <source>…`: read more sources in an existing feed. */
export function feedAdd(words: readonly string[], context: CommandContext): CommandOutcome {
  const read = feedAndSources(words, context, 'add <name> <source>…');
  if (!read.ok) {
    return read.error;
  }
  const { feed, refs } = read.value;
  saveFeeds(context, addSource(context.state.settings.feeds, feed.id, refs));
  context.print(`~${feed.name} reads ${words.slice(1).join(' ')}`);
  return OK;
}

/** `rm <name> <source>…`: stop reading sources; it refuses when the feed read none of them. */
export function feedRemove(words: readonly string[], context: CommandContext): CommandOutcome {
  const read = feedAndSources(words, context, 'rm <name> <source>…');
  if (!read.ok) {
    return read.error;
  }
  const { feed, refs } = read.value;
  const held = refs.filter((ref) =>
    feed.sources.some((s) => s.accountKey === ref.accountKey && s.source === ref.source),
  );
  const text = words.slice(1).join(' ');
  if (held.length === 0) {
    return fail(`~${feed.name} reads none of ${text}`);
  }
  saveFeeds(
    context,
    held.reduce((next, ref) => removeSource(next, feed.id, ref), context.state.settings.feeds),
  );
  context.print(`~${feed.name} no longer reads ${text}`);
  return OK;
}
