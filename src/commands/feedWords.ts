/**
 * Tab completion for `/feed` (decision 6 and 14): the first argument completes
 * to a subcommand or a feed name (`/feed <name>` opens it), the feed argument
 * of `open`, `add`, `rm`, `rename` and `delete` to a feed name, and the source
 * words of `new`, `add` and `rm` to `<who>:<kind>` — `*` or a signed-in
 * account's `@handle`, then one of the source kinds. The new name of `new` and
 * `rename` is the reader's to make up, so it completes to nothing.
 */

import type { Provider } from './complete';
import { FEED_SUBCOMMANDS } from './feedArgs';
import { compareWords, wordsOf } from '../lib/words';
import type { AppState } from '../state/appState';

/** A line that is a `/feed` command with at least one argument started. */
const FEED_LINE = /^\s*\/feed\s/iu;

/** The subcommands whose first argument names a saved feed. */
const FEED_ARGUMENT = ['open', 'add', 'rm', 'rename', 'delete'];

/** The subcommands whose words after the feed's name are sources. */
const SOURCE_ARGUMENT = ['new', 'add', 'rm'];

/** The source kinds that take no argument, and `tag:` which wants one more. */
const SOURCE_KINDS = ['home', 'mentions', 'dms', 'notifications', 'local', 'federated', 'tag:'];

/** The `<who>:` words a source can start with: every account and `*` for all of them. */
function whoWords(state: AppState): readonly string[] {
  return ['*', ...state.accounts.map((account) => `@${account.handle}`)];
}

/** Every `<who>:<kind>` word that starts with {@link word}, ignoring case. */
function sourceWords(word: string, state: AppState): readonly string[] {
  const lower = word.toLowerCase();
  const all = whoWords(state).flatMap((who) => SOURCE_KINDS.map((kind) => `${who}:${kind}`));
  return all.filter((candidate) => candidate.toLowerCase().startsWith(lower));
}

/** The names of the saved feeds that start with {@link prefix}, ignoring case and a leading `~`. */
function feedNames(prefix: string, state: AppState): readonly string[] {
  const lower = prefix.toLowerCase().replace(/^~/u, '');
  return state.settings.feeds
    .map((feed) => feed.name)
    .filter((name) => name.toLowerCase().startsWith(lower));
}

/** What the word after {@link before}'s words may complete to, unsorted. */
function wordsFor(word: string, before: string, state: AppState): readonly string[] {
  const done = wordsOf(before);
  const position = done.length;
  const sub = (done[1] ?? '').toLowerCase();
  if (position === 1) {
    const subs = FEED_SUBCOMMANDS.filter((name) => name.startsWith(word.toLowerCase()));
    return [...subs, ...feedNames(word, state)];
  }
  if (position === 2 && FEED_ARGUMENT.includes(sub)) {
    return feedNames(word, state);
  }
  return position >= 3 && SOURCE_ARGUMENT.includes(sub) ? sourceWords(word, state) : [];
}

/** The provider for the words after `/feed`, over the accounts and feeds {@link state} holds. */
export function feedProvider(state: AppState): Provider {
  return {
    accepts: (_word, isFirstWord, line) => !isFirstWord && FEED_LINE.test(line ?? ''),
    candidates: (word, before = '') => wordsFor(word, before, state).toSorted(compareWords),
  };
}
