/**
 * The external-login consent box's state (WFE-169): the app's details are
 * fetched anonymously when the box opens, and an answer is posted once. The
 * address the browser is sent to comes from the answer, checked by ./outcome.
 */
import { useEffect, useState } from 'react';

import { describeExternalError, settleRedirect } from './outcome';
import {
  type ConsentInfo,
  getExternalConsent,
  postExternalConsent,
} from '../../api/endpoints/external';
import type { ApiSession } from '../../api/session';

/** What the box is showing. */
export type Phase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ask'; readonly info: ConsentInfo; readonly sending: boolean }
  | { readonly kind: 'finished' | 'error'; readonly message: string };

/** What the box needs: the instance, the login's tokens, and how to leave the page. */
export type ConsentSetup = {
  readonly session: ApiSession;
  readonly state: string;
  readonly confirmToken: string;
  readonly navigate: (url: string) => void;
};

/** The box's phase and the answer to give. */
export type ConsentState = {
  readonly phase: Phase;
  readonly decide: (approve: boolean) => Promise<void>;
};

/** Fetch the app's details for {@link setup} once when the box mounts, and answer decisions. */
export function useConsent(setup: ConsentSetup): ConsentState {
  const { session, state, confirmToken, navigate } = setup;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    let current = true;
    void getExternalConsent(session, state, confirmToken).then((answer) => {
      if (current) {
        setPhase(
          answer.ok
            ? { kind: 'ask', info: answer.value, sending: false }
            : { kind: 'error', message: describeExternalError(answer.error) },
        );
      }
    });
    return () => {
      current = false;
    };
  }, [session, state, confirmToken]);

  async function decide(approve: boolean): Promise<void> {
    if (phase.kind !== 'ask' || phase.sending) {
      return;
    }
    setPhase({ ...phase, sending: true });
    const answer = await postExternalConsent(session, {
      state,
      confirm_token: confirmToken,
      approve,
    });
    setPhase(
      answer.ok
        ? settleRedirect(answer.value, navigate)
        : { kind: 'error', message: describeExternalError(answer.error) },
    );
  }

  return { phase, decide };
}
