/**
 * The authorization box's state (WFE-168): the app info is fetched when the
 * box opens, and a decision is posted once under the account's bearer token.
 * The token travels only in the request header; the address the browser is
 * sent to comes from the answer, checked by ./settle.
 */
import { useEffect, useState } from 'react';

import { authorizeBody } from './authorizeBody';
import { describeAuthorizeError } from './describeError';
import { type Settled, settle } from './settle';
import { type AuthorizeInfo, getAuthorizeInfo, postAuthorize } from '../../api/endpoints/authorize';
import type { ApiSession } from '../../api/session';

/** What the box is showing. */
export type Phase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ask'; readonly info: AuthorizeInfo; readonly sending: boolean }
  | Settled;

/** What the box needs: who is asking the instance, what was asked, and how to leave the page. */
export type AuthorizeSetup = {
  readonly session: ApiSession;
  /** The query parameters of the authorization request. */
  readonly query: Readonly<Record<string, string>>;
  readonly navigate: (url: string) => void;
};

/** The box's phase and the answer to give. */
export type AuthorizeState = {
  readonly phase: Phase;
  readonly decide: (approve: boolean) => Promise<void>;
};

/** Fetch the app info for {@link setup} once when the box mounts, and answer decisions. */
export function useAuthorize(setup: AuthorizeSetup): AuthorizeState {
  const { session, query, navigate } = setup;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    let current = true;
    void getAuthorizeInfo(session, query).then((answer) => {
      if (current) {
        setPhase(
          answer.ok
            ? { kind: 'ask', info: answer.value, sending: false }
            : { kind: 'error', message: describeAuthorizeError(answer.error) },
        );
      }
    });
    return () => {
      current = false;
    };
  }, [session, query]);

  async function decide(approve: boolean): Promise<void> {
    if (phase.kind !== 'ask' || phase.sending) {
      return;
    }
    setPhase({ ...phase, sending: true });
    const answer = await postAuthorize(session, authorizeBody(query, phase.info, approve));
    setPhase(
      answer.ok
        ? settle(answer.value, navigate)
        : { kind: 'error', message: describeAuthorizeError(answer.error) },
    );
  }

  return { phase, decide };
}
