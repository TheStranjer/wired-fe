/**
 * The custom emojis of one account's instance (WFE-124): `listCustomEmojis`
 * is asked once per origin and the answer lives in a module-level map for the
 * rest of the session, so a second window or a second account on the same
 * instance pays nothing and an instance that will not answer simply has no
 * emoji. The `:` completion (./completionProviders) and the emoji picker of a
 * later ticket both read the list through this hook.
 */

import { useEffect, useState } from 'react';

import { listCustomEmojis } from '../api/endpoints/customEmojis';
import type { CustomEmoji } from '../api/schemas/customEmoji';
import type { ApiSession } from '../api/session';
import { accountByKey } from '../state/selectors';
import { useAppState } from '../state/StateContext';

/** An instance with no answer: one stable list, so re-setting it changes nothing. */
const NO_EMOJIS: readonly CustomEmoji[] = [];

/** The list every origin has answered, kept for the life of the module. */
const emojisByOrigin = new Map<string, readonly CustomEmoji[]>();

/** The request each origin has in flight, so two mounts on one instance pay one fetch. */
const pendingByOrigin = new Map<string, Promise<readonly CustomEmoji[]>>();

/** The answer one mount waited for: whose instance, and what it served. */
type Fetched = {
  readonly origin: string;
  readonly emojis: readonly CustomEmoji[];
};

/**
 * The {@link session}'s instance's custom emojis: the cached list where there
 * is one, the shared request where one is in flight, and a fresh fetch else.
 * A refused or broken answer is cached as {@link NO_EMOJIS}: once per origin
 * means once, whichever way it ends.
 */
async function loadEmojis(session: ApiSession): Promise<readonly CustomEmoji[]> {
  const cached = emojisByOrigin.get(session.origin);
  if (cached !== undefined) {
    return cached;
  }
  const running = pendingByOrigin.get(session.origin);
  if (running !== undefined) {
    return running;
  }
  const fresh = listCustomEmojis(session).then((outcome) => {
    const emojis = outcome.ok ? outcome.value : NO_EMOJIS;
    emojisByOrigin.set(session.origin, emojis);
    pendingByOrigin.delete(session.origin);
    return emojis;
  });
  pendingByOrigin.set(session.origin, fresh);
  return fresh;
}

/**
 * The custom emoji list of {@link accountKey}'s instance: empty while no
 * account stands there or the first fetch of its origin is still out, and the
 * moment an origin has answered every hook on it sees the same list.
 */
export function useCustomEmojis(accountKey: string | null): readonly CustomEmoji[] {
  const state = useAppState();
  const account = accountByKey(state, accountKey);
  const origin = account === null ? null : account.origin;
  const token = account === null ? null : account.token;
  const [fetched, setFetched] = useState<Fetched | null>(null);

  useEffect(() => {
    if (origin === null) {
      return;
    }
    let listening = true;
    void loadEmojis({ origin, token }).then((emojis) => {
      if (listening) {
        setFetched({ emojis, origin });
      }
    });
    return () => {
      listening = false;
    };
  }, [origin, token]);

  if (origin === null) {
    return NO_EMOJIS;
  }
  if (fetched !== null && fetched.origin === origin) {
    return fetched.emojis;
  }
  return emojisByOrigin.get(origin) ?? NO_EMOJIS;
}
