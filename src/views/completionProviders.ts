/**
 * The completion providers the views layer can answer (decision 6, WFE-124):
 * the words the Tab engine of src/commands/complete offers from what the
 * windows have already shown and what the active account's instance serves,
 * and the rows the suggestion list draws for them (WFE-300). Handles come
 * from every account any buffer carried — post authors, boosters, mentions,
 * notification accounts — plus the signed-in accounts, and below them the
 * accounts the instance's search found for the typed word
 * (./useHandleSearch); a handle is described by its display name. Tags come
 * from the tags of the statuses in buffers; emoji from the custom emoji list
 * of ./useCustomEmojis, each shown with its image. The engine's own seam,
 * Provider, lives in src/commands/complete; the layering
 * (tooling/eslint/layers.js) gives views no path to commands, so
 * {@link CompletionProvider} restates that shape and the composition root
 * joins the two where it may import both.
 */

import {
  type CompletionNote,
  acceptsWord,
  appended,
  completionList,
  namesOf,
  once,
  plainNote,
} from './completionKit';
import { HANDLE_PREFIX, type NamedWord, TAG_PREFIX, seenHandles, seenTags } from './seenWords';
import type { CustomEmoji } from '../api/schemas/customEmoji';
import type { AppState } from '../state/appState';
import { isHttps } from '../ui/emojify';

/** What an emoji word is written with, around the shortcode and while typing it. */
const EMOJI_PREFIX = ':';

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
  /** The row for one of {@link candidates}, for the suggestion list. */
  readonly describe?: (candidate: string) => CompletionNote | undefined;
  /** True when the provider also answers the empty word after a space. */
  readonly bare?: true;
};

/**
 * The accounts the instance's search found, as handle words with their
 * display names, by the lowercase word they were searched for
 * (./useHandleSearch).
 */
export type HandleSearch = ReadonlyMap<string, readonly NamedWord[]>;

/** The search that found nothing: what a provider stands on before the first answer. */
export const NO_SEARCH: HandleSearch = new Map();

/**
 * The provider for handles: a word starting with `@` completes to `@acct` of
 * every account any buffer showed and every signed-in account (case-insensitive
 * prefix match, deduplicated, sorted), then to the accounts {@link searched}
 * found for that word, below them and without repeating one. Each is
 * described by its display name, as the server wrote it: `:shortcode:` text
 * stays text.
 */
export function handleProvider(
  state: AppState,
  searched: HandleSearch = NO_SEARCH,
): CompletionProvider {
  const seen = once(() => seenHandles(state));
  const names = once(() => namesOf([...seen(), ...[...searched.values()].flat()]));
  return {
    accepts: acceptsWord(HANDLE_PREFIX, 0),
    candidates: (word) =>
      appended(
        completionList(
          seen().map((one) => one.word),
          word,
        ),
        (searched.get(word.toLowerCase()) ?? []).map((one) => one.word),
      ),
    describe: (candidate) => plainNote(candidate, names().get(candidate.toLowerCase()) ?? ''),
  };
}

/**
 * The provider for hashtags: a word starting with `#` completes to `#name` of
 * every tag the statuses in the buffers carry. A tag has no description.
 */
export function tagProvider(state: AppState): CompletionProvider {
  return {
    accepts: acceptsWord(TAG_PREFIX, 0),
    candidates: (word) => completionList(seenTags(state), word),
    describe: (candidate) => plainNote(candidate, ''),
  };
}

/** The row of an emoji: its `:shortcode:` beside its still image, when that is an https URL. */
function emojiNote(word: string, emoji: CustomEmoji | undefined): CompletionNote {
  const note = plainNote(word, '');
  return emoji !== undefined && isHttps(emoji.static_url)
    ? { ...note, image: emoji.static_url }
    : note;
}

/**
 * The provider for custom emoji: a word starting with `:` and at least one
 * more character completes to `:shortcode:` from {@link emojis}, the active
 * account's instance's list (./useCustomEmojis); each row shows the emoji.
 */
export function emojiProvider(emojis: readonly CustomEmoji[]): CompletionProvider {
  const words = emojis.map((emoji) => `${EMOJI_PREFIX}${emoji.shortcode}${EMOJI_PREFIX}`);
  return {
    accepts: acceptsWord(EMOJI_PREFIX, 1),
    candidates: (word) => completionList(words, word),
    describe: (candidate) => {
      const index = words.findIndex((word) => word.toLowerCase() === candidate.toLowerCase());
      return emojiNote(candidate, emojis[index]);
    },
  };
}
