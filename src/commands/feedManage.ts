/**
 * The `/feed` subcommands that manage whole feeds (decision 14): `list` prints
 * every feed with its sources, `open` shows a feed's window, `edit` its editor
 * (src/features/feedEditor), `rename` renames a feed and retitles its windows,
 * `delete` forgets a feed and closes them, editors too. Each
 * handler takes the words after its subcommand and refuses with a message,
 * changing nothing, when they are wrong.
 */

import { bareName, feedUsage, findFeed, reservedName, saveFeeds } from './feedArgs';
import { OK, fail } from './outcome';
import type { CommandContext, CommandOutcome } from './types';
import { type Result, err } from '../lib/result';
import { editsFeed, feedEditorOpen, feedEditorTitle } from '../state/feedEditorWindow';
import {
  type FeedSourceRef,
  type FeedSpec,
  type Feeds,
  removeFeed,
  renameFeed,
} from '../state/feeds';
import { feedWindowOpen, feedWindowTitle, showsFeed } from '../state/feedWindow';
import type { WindowState } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** One source as the reader writes it: `@handle:source`, or `?:source` for an account signed out since. */
function sourceText(ref: FeedSourceRef, context: CommandContext): string {
  const account = context.state.accounts.find((a) => a.key === ref.accountKey);
  return `${account === undefined ? '?' : `@${account.handle}`}:${ref.source}`;
}

/** One feed as one client message: its title, id and sources. */
function feedLine(feed: FeedSpec, context: CommandContext): string {
  const sources = feed.sources.map((ref) => sourceText(ref, context)).join(' ');
  return `${feedWindowTitle(feed)} (${feed.id}): ${sources === '' ? 'no sources' : sources}`;
}

/** Dispatch what {@link action} makes of each window that shows or edits the feed {@link feedId}. */
function forFeedWindows(
  context: CommandContext,
  feedId: string,
  action: (window: WindowState) => WindowsAction,
): void {
  const mine = context.windows.windows.filter((w) => showsFeed(w, feedId) || editsFeed(w, feedId));
  for (const win of mine) {
    context.dispatchWindows(action(win));
  }
}

/** `edit <name>`: show the feed's editor, or activate the one that already does. */
export function feedEdit(words: readonly string[], context: CommandContext): CommandOutcome {
  const [word, ...extra] = words;
  if (word === undefined || extra.length > 0) {
    return feedUsage('edit <name>');
  }
  const feed = findFeed(context, word);
  if (!feed.ok) {
    return fail(feed.error);
  }
  context.dispatchWindows(feedEditorOpen(feed.value));
  return OK;
}

/** `list`: print every feed with its sources. */
export function feedList(_words: readonly string[], context: CommandContext): CommandOutcome {
  const { feeds } = context.state.settings;
  if (feeds.length === 0) {
    context.print('No feeds. Make one with /feed new <name> <source>…');
  }
  for (const feed of feeds) {
    context.print(feedLine(feed, context));
  }
  return OK;
}

/** `open <name>`: show the feed's window, or activate the one that already does. */
export function feedOpen(words: readonly string[], context: CommandContext): CommandOutcome {
  const [word, ...extra] = words;
  if (word === undefined || extra.length > 0) {
    return feedUsage('open <name>');
  }
  const feed = findFeed(context, word);
  if (!feed.ok) {
    return fail(feed.error);
  }
  context.dispatchWindows(feedWindowOpen(feed.value));
  return OK;
}

/** The feed list with {@link feed} named {@link name}, or why that name is refused. */
function renamedFeeds(
  context: CommandContext,
  feed: FeedSpec,
  name: string,
): Result<Feeds, string> {
  const reserved = reservedName(name);
  return reserved === null
    ? renameFeed(context.state.settings.feeds, feed.id, name)
    : err(reserved);
}

/** `rename <old> <new>`: rename the feed; the windows showing it take the new title. */
export function feedRename(words: readonly string[], context: CommandContext): CommandOutcome {
  const [word, next, ...extra] = words;
  if (word === undefined || next === undefined || extra.length > 0) {
    return feedUsage('rename <old> <new>');
  }
  const feed = findFeed(context, word);
  if (!feed.ok) {
    return fail(feed.error);
  }
  const name = bareName(next);
  const renamed = renamedFeeds(context, feed.value, name);
  if (!renamed.ok) {
    return fail(renamed.error);
  }
  saveFeeds(context, renamed.value);
  const spec = { ...feed.value, name };
  forFeedWindows(context, feed.value.id, (win) => ({
    type: 'retitle',
    id: win.id,
    title: win.ref.kind === 'feedEditor' ? feedEditorTitle(spec) : feedWindowTitle(spec),
  }));
  context.print(`Renamed ~${feed.value.name} to ~${name}`);
  return OK;
}

/** `delete <name>`: forget the feed and close the windows showing or editing it. */
export function feedDelete(words: readonly string[], context: CommandContext): CommandOutcome {
  const [word, ...extra] = words;
  if (word === undefined || extra.length > 0) {
    return feedUsage('delete <name>');
  }
  const feed = findFeed(context, word);
  if (!feed.ok) {
    return fail(feed.error);
  }
  saveFeeds(context, removeFeed(context.state.settings.feeds, feed.value.id));
  forFeedWindows(context, feed.value.id, (win) => ({ type: 'close', id: win.id }));
  context.print(`Deleted ~${feed.value.name}`);
  return OK;
}
