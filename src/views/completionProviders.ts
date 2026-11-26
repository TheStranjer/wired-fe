/**
 * The completion providers the views layer can answer (decision 6, WFE-124):
 * the words the Tab engine of src/commands/complete offers from what the
 * windows have already shown and what the active account's instance serves.
 * Handles come from every account any buffer carried — post authors,
 * boosters, mentions, notification accounts — plus the signed-in accounts;
 * tags from the tags of the statuses in buffers; emoji from the custom emoji
 * list of ./useCustomEmojis. The engine's own seam, Provider, lives in
 * src/commands/complete; the layering (tooling/eslint/layers.js) gives views
 * no path to commands, so {@link CompletionProvider} restates that shape and
 * the composition root joins the two where it may import both.
 */

import type { CustomEmoji } from '../api/schemas/customEmoji';
import type { Status } from '../api/schemas/status';
import { compareWords } from '../lib/words';
import type { AppState } from '../state/appState';
import type { LineData } from '../state/buffer';

/** What a handle word is written with. */
const HANDLE_PREFIX = '@';

/** What a tag word is written with. */
const TAG_PREFIX = '#';

/** What an emoji word is written with, around the shortcode and while typing it. */
const EMOJI_PREFIX = ':';

/** The most candidates one word may offer, newest lists stay cheap to show. */
const MAX_CANDIDATES = 50;

/**
 * The completion engine's seam, restated (see the module comment): the same
 * shape as the Provider of src/commands/complete, structurally compatible
 * with it, so the app layer can hand these to `startCompletion` directly.
 */
export type CompletionProvider = {
  /** True when this provider handles a word with this prefix character, e.g. '@', ':', '#', '/'. */
  readonly accepts: (word: string, isFirstWord: boolean, line?: string) => boolean;
  /**
   * Every full replacement word for {@link word}, sorted; empty when none
   * match. {@link before} is the line's text in front of the word.
   */
  readonly candidates: (word: string, before?: string) => readonly string[];
  /** The suggestion row of one candidate, the shape of the engine's Described. */
  readonly describe?: (candidate: string) => CompletionNote | undefined;
  /** True when the provider also answers the empty word after a space. */
  readonly bare?: true;
};

/** How a suggestion list shows one candidate: Described of src/commands/complete, restated. */
export type CompletionNote = {
  readonly word: string;
  readonly label: string;
  readonly description: string;
};

/** The accepts of a kind: {@link prefix} and at least {@link rest} more characters. */
function acceptsWord(prefix: string, rest: number): (word: string) => boolean {
  return (word: string): boolean => word.startsWith(prefix) && word.length >= prefix.length + rest;
}

/**
 * The {@link values} that start with {@link word}, ignoring case: the first
 * spelling of each lowercase form, sorted, at most {@link MAX_CANDIDATES}.
 */
function completionList(values: readonly string[], word: string): readonly string[] {
  const prefix = word.toLowerCase();
  const seen = new Set<string>();
  const matches: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (key.startsWith(prefix) && !seen.has(key)) {
      seen.add(key);
      matches.push(value);
    }
  }
  return matches.toSorted(compareWords).slice(0, MAX_CANDIDATES);
}

/** The word completion writes for the acct {@link value}. */
function withPrefix(prefix: string, value: string): string {
  return `${prefix}${value}`;
}

/** Every account a status names: its author, its mentions, and the same for
 * the reblog it boosts and the quote it carries. */
function statusHandles(status: Status): string[] {
  const handles = [
    withPrefix(HANDLE_PREFIX, status.account.acct),
    ...status.mentions.map((mention) => withPrefix(HANDLE_PREFIX, mention.acct)),
  ];
  if (status.reblog !== null) {
    handles.push(...statusHandles(status.reblog));
  }
  if (status.quote !== null) {
    handles.push(...statusHandles(status.quote));
  }
  return handles;
}

/** Every account one scrollback line names. */
function lineHandles(line: LineData): readonly string[] {
  if (line.kind === 'post') {
    return statusHandles(line.status);
  }
  if (line.kind === 'notification') {
    const { account, status } = line.notification;
    const named = [withPrefix(HANDLE_PREFIX, account.acct)];
    if (status !== null) {
      named.push(...statusHandles(status));
    }
    return named;
  }
  return [];
}

/** Every handle the buffers have shown, plus the signed-in accounts' own. */
function seenHandles(state: AppState): string[] {
  const handles = state.accounts.map((account) => withPrefix(HANDLE_PREFIX, account.handle));
  for (const buffer of state.buffers.values()) {
    for (const line of buffer.lines) {
      handles.push(...lineHandles(line));
    }
  }
  return handles;
}

/** Every tag a status carries, and the same for its reblog and its quote. */
function statusTags(status: Status): string[] {
  const tags = status.tags.map((tag) => withPrefix(TAG_PREFIX, tag.name));
  if (status.reblog !== null) {
    tags.push(...statusTags(status.reblog));
  }
  if (status.quote !== null) {
    tags.push(...statusTags(status.quote));
  }
  return tags;
}

/** Every tag one scrollback line carries. */
function lineTags(line: LineData): readonly string[] {
  if (line.kind === 'post') {
    return statusTags(line.status);
  }
  if (line.kind === 'notification') {
    return line.notification.status === null ? [] : statusTags(line.notification.status);
  }
  return [];
}

/** Every tag the buffers have shown. */
function seenTags(state: AppState): string[] {
  const tags: string[] = [];
  for (const buffer of state.buffers.values()) {
    for (const line of buffer.lines) {
      tags.push(...lineTags(line));
    }
  }
  return tags;
}

/**
 * The provider for handles: a word starting with `@` completes to `@acct` of
 * every account any buffer showed and every signed-in account (case-insensitive
 * prefix match, deduplicated, sorted, at most {@link MAX_CANDIDATES}).
 */
export function handleProvider(state: AppState): CompletionProvider {
  return {
    accepts: acceptsWord(HANDLE_PREFIX, 0),
    candidates: (word) => completionList(seenHandles(state), word),
  };
}

/**
 * The provider for hashtags: a word starting with `#` completes to `#name` of
 * every tag the statuses in the buffers carry.
 */
export function tagProvider(state: AppState): CompletionProvider {
  return {
    accepts: acceptsWord(TAG_PREFIX, 0),
    candidates: (word) => completionList(seenTags(state), word),
  };
}

/**
 * The provider for custom emoji: a word starting with `:` and at least one
 * more character completes to `:shortcode:` from {@link emojis}, the active
 * account's instance's list (./useCustomEmojis).
 */
export function emojiProvider(emojis: readonly CustomEmoji[]): CompletionProvider {
  return {
    accepts: acceptsWord(EMOJI_PREFIX, 1),
    candidates: (word) =>
      completionList(
        emojis.map((emoji) => `${EMOJI_PREFIX}${emoji.shortcode}${EMOJI_PREFIX}`),
        word,
      ),
  };
}
