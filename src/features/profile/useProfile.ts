/**
 * The whois data of one profile window (WFE-106): the account the window
 * targets, fetched once through that window's own account with
 * `getAccount`, together with the viewer's side of the relationship from
 * `relationships([id])`, mapped onto the plain props the ui whois block
 * shows. Every outcome goes through the application's reducer the way the
 * page loaders do: a failed lookup prints its description into the window's
 * scrollback, and a fetch whose window closed while the instance was thinking
 * reports nothing at all.
 */

import { useEffect, useState } from 'react';

import { fullHandle } from '../../accounts/handle';
import { getAccount, relationships } from '../../api/endpoints/accountRead';
import { type ApiError, describeApiError } from '../../api/errors';
import type { Account } from '../../api/schemas/account';
import type { Relationship } from '../../api/schemas/relationship';
import type { ApiSession } from '../../api/session';
import type { Result } from '../../lib/result';
import { accountByKey, windowAccountKey } from '../../state/selectors';
import type { Dispatch } from '../../state/StateContext';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import type { WhoisBlockProps } from '../../ui/WhoisBlock';

/** What one profile fetch answers: the account, and how far the viewer knows it. */
type Loaded = {
  readonly account: Account;
  readonly relationship: Relationship | null;
};

/** The fetch's inputs, handed to {@link fetchWhois} as one job. */
export type WhoisJob = {
  readonly session: ApiSession;
  readonly id: string;
  readonly windowId: string;
  readonly signal: AbortSignal;
  readonly dispatch: Dispatch;
  readonly setLoaded: (loaded: Loaded) => void;
};

/** Map {@link account} and the viewer's {@link relationship} onto the whois lines. */
function whoisView(
  account: Account,
  relationship: Relationship | null,
  origin: string,
): WhoisBlockProps {
  return {
    displayName: account.display_name === '' ? account.username : account.display_name,
    handle: fullHandle(account, origin),
    bioHtml: account.note,
    fields: account.fields.map((field) => ({
      name: field.name,
      valueHtml: field.value,
      verified: field.verified_at !== null,
    })),
    counts: {
      posts: account.statuses_count,
      following: account.following_count,
      followers: account.followers_count,
    },
    joined: account.created_at.slice(0, 10),
    relationships: {
      following: relationship?.following ?? false,
      followedBy: relationship?.followed_by ?? false,
      blocked: relationship?.blocking ?? false,
      muted: relationship?.muting ?? false,
    },
  };
}

/** Print why the account never arrived, once, into the window's scrollback. */
function printFailure(job: WhoisJob, error: ApiError): void {
  job.dispatch({
    type: 'print',
    windowId: job.windowId,
    date: new Date(),
    level: 'error',
    text: describeApiError(error),
  });
}

/** The viewer's side of it from the relationship answer; none for no answer. */
function relationshipOf(
  related: Result<readonly Relationship[], ApiError> | null,
): Relationship | null {
  if (related?.ok !== true) {
    return null;
  }
  return related.value[0] ?? null;
}

/**
 * Fetch the account, then — only when it arrived — the relationship for it;
 * report once, at the end, and report nothing if the window closed while the
 * instance was thinking.
 */
export async function fetchWhois(job: WhoisJob): Promise<void> {
  const found = await getAccount(job.session, job.id, job.signal);
  const related = found.ok ? await relationships(job.session, [job.id], job.signal) : null;
  if (job.signal.aborted) {
    return;
  }
  if (found.ok) {
    job.setLoaded({ account: found.value, relationship: relationshipOf(related) });
    return;
  }
  printFailure(job, found.error);
}

/**
 * The whois lines of the account {@link windowId}'s window targets, or null
 * while they have not arrived (or never will: no window, no account). The
 * fetch runs once per target through the window's own account and aborts with
 * the window; the relationship rides along when the instance reports one.
 */
export function useProfile(windowId: string): WhoisBlockProps | null {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const target = state.windows.windows.find((win) => win.id === windowId)?.ref.target ?? null;
  const owner = accountByKey(state, windowAccountKey(state, windowId));
  const origin = owner?.origin ?? '';
  const token = owner?.token ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (target === null || token === null) {
      return;
    }
    const controller = new AbortController();
    void fetchWhois({
      session: { origin, token },
      id: target,
      windowId,
      signal: controller.signal,
      dispatch,
      setLoaded,
    });
    return () => {
      controller.abort();
    };
  }, [target, origin, token, windowId, dispatch]);

  return loaded === null ? null : whoisView(loaded.account, loaded.relationship, origin);
}
