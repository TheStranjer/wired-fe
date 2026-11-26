/**
 * The accounts the active account's instance finds for the `@handle` being
 * typed (WFE-300): a pause of {@link SEARCH_PAUSE_MS} after the last
 * keystroke, with at least two characters after the `@`, one accounts search
 * of src/api (`resolve` where {@link shouldResolve} says the word names a
 * remote account). Answers are kept by the word they were asked for, per
 * account, so the same word is never asked twice and an answer that comes
 * back after the word changed is cancelled with its request and never shows.
 * A refused or broken search is silent: the handles the buffers showed stay.
 */

import { useEffect, useState } from 'react';

import { type HandleSearch, NO_SEARCH } from './completionProviders';
import { HANDLE_PREFIX, type NamedWord, handleOf } from './seenWords';
import { search, shouldResolve } from '../api/endpoints/search';
import type { ApiSession } from '../api/session';
import { accountByKey } from '../state/selectors';
import { useAppState } from '../state/StateContext';

/** How long the word must stand still before the instance is asked. */
const SEARCH_PAUSE_MS = 250;

/** How many accounts one search asks for. */
const SEARCH_LIMIT = 10;

/** A handle word: an `@` and at least two more characters, the last word before the caret. */
const HANDLE_WORD = /(?:^|\s)(@\S{2,})$/u;

/** What the searches of every account have found so far, by account key. */
type Found = ReadonlyMap<string, HandleSearch>;

/** One answer: whose search, which word it was for, and the handles it found. */
type Answer = {
  readonly accountKey: string;
  readonly word: string;
  readonly handles: readonly NamedWord[];
};

/**
 * The handle word the caret is at the end of in {@link text} (the word
 * runs from the last whitespace before the caret), or null when the caret is
 * not in a handle with enough typed to search for.
 */
export function handleWordAt(text: string, caret: number): string | null {
  return HANDLE_WORD.exec(text.slice(0, caret))?.[1] ?? null;
}

/** {@link found} with {@link answer} added under its account. */
function withAnswer(found: Found, answer: Answer): Found {
  const mine = new Map(found.get(answer.accountKey)).set(answer.word, answer.handles);
  return new Map(found).set(answer.accountKey, mine);
}

/** The handles {@link session}'s instance finds for {@link word}; null when it cannot say. */
async function lookup(
  session: ApiSession,
  word: string,
  signal: AbortSignal,
): Promise<readonly NamedWord[] | null> {
  const query = word.slice(HANDLE_PREFIX.length);
  const options = { type: 'accounts', resolve: shouldResolve(query), limit: SEARCH_LIMIT } as const;
  const outcome = await search(session, query, options, signal);
  return outcome.ok ? outcome.value.accounts.map(handleOf) : null;
}

/**
 * Ask {@link session}'s instance for the accounts of {@link word} once the
 * pause has passed, and hand what it finds to {@link deliver} unless the
 * returned cancel ran first: it stops the pause, cancels the request and
 * drops an answer already on its way.
 */
function askLater(
  session: ApiSession,
  word: string,
  deliver: (handles: readonly NamedWord[]) => void,
): () => void {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    void lookup(session, word, controller.signal).then((handles) => {
      if (handles !== null && !controller.signal.aborted) {
        deliver(handles);
      }
    });
  }, SEARCH_PAUSE_MS);
  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}

/**
 * What the active account's instance has found for the handle {@link word}
 * (null for no handle at the caret) and for every word asked before it:
 * the handles by lowercase word, empty until the first answer.
 */
export function useHandleSearch(word: string | null): HandleSearch {
  const state = useAppState();
  const account = accountByKey(state, state.activeAccountKey);
  const accountKey = account === null ? '' : account.key;
  const origin = account === null ? null : account.origin;
  const token = account === null ? null : account.token;
  const [found, setFound] = useState<Found>(() => new Map());
  const mine = found.get(accountKey) ?? NO_SEARCH;
  const asked = word !== null && mine.has(word.toLowerCase());

  useEffect(() => {
    if (origin === null || word === null || asked) {
      return;
    }
    return askLater({ origin, token }, word, (handles) => {
      setFound((all) => withAnswer(all, { accountKey, word: word.toLowerCase(), handles }));
    });
  }, [accountKey, origin, token, word, asked]);

  return mine;
}
