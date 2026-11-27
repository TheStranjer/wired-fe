/**
 * Tests for the profile loader of a signed-out visitor (WFE-340): the account
 * is read with no `Authorization` header and no relationship is asked for (a
 * visitor has none), a 401 or 403 from the instance is reported as its refusal
 * of the read, and any other failure only prints. A signed-in lookup refused
 * the same way is no business of the signed-out fallback.
 */
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { type Mock, describe, expect, it, vi } from 'vitest';

import { fetchWhois, useProfile, type WhoisJob } from './useProfile';
import { initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { AppStateProvider, type Dispatch } from '../../state/StateContext';
import { ANON_KEY, ANON_ORIGIN } from '../../test/anonWindow';
import { server } from '../../test/server';
import { type WindowRef, windowId } from '../../windows/model';

const REF: WindowRef = { kind: 'profile', accountKey: ANON_KEY, target: '9' };
const WINDOW = windowId(REF);

/** Nine's wire shape. */
const NINE_WIRE = {
  id: '9',
  username: 'nine',
  acct: 'nine',
  display_name: 'Nine',
  created_at: '2024-01-02T10:00:00.000Z',
  note: '',
  url: `${ANON_ORIGIN}/@nine`,
  avatar: `${ANON_ORIGIN}/avi.png`,
  header: `${ANON_ORIGIN}/banner.png`,
  followers_count: 300,
  following_count: 80,
  statuses_count: 120,
  fields: [],
};

/** A visitor with no account and nine's signed-out profile window open. */
const VISITOR = appReducer(initialAppState(), {
  type: 'windows',
  action: { type: 'open', ref: REF, title: '@nine' },
});

/** The name the hook produced, or nothing. */
function Probe(): JSX.Element {
  const whois = useProfile(WINDOW);
  return (
    <span>
      {whois === null
        ? 'nothing'
        : `${whois.displayName} holds ${String(Object.values(whois.relationships).filter(Boolean).length)}`}
    </span>
  );
}

/** A load of nine's account for a session with {@link token}, and the spies it reports to. */
function jobOf(token: string | null): {
  readonly job: WhoisJob;
  readonly dispatch: Mock<Dispatch>;
  readonly setLoaded: Mock<WhoisJob['setLoaded']>;
} {
  const dispatch = vi.fn<Dispatch>();
  const setLoaded = vi.fn<WhoisJob['setLoaded']>();
  const job: WhoisJob = {
    session: { origin: ANON_ORIGIN, token },
    id: '9',
    windowId: WINDOW,
    signal: new AbortController().signal,
    dispatch,
    setLoaded,
  };
  return { job, dispatch, setLoaded };
}

/** Serve nine's account with {@link status}, and record the Authorization header of each request. */
function serveNine(status: number): (string | null)[] {
  const seen: (string | null)[] = [];
  server.use(
    http.get(`${ANON_ORIGIN}/api/v1/accounts/9`, ({ request }) => {
      seen.push(request.headers.get('Authorization'));
      return status === 200
        ? HttpResponse.json(NINE_WIRE)
        : HttpResponse.json({ error: 'no' }, { status });
    }),
  );
  return seen;
}

describe('the profile loader of a signed-out visitor', () => {
  it('reads the account with no token and asks for no relationship', async () => {
    // No relationships handler is registered: asking would fail this test.
    const seen = serveNine(200);
    render(
      <AppStateProvider initial={VISITOR}>
        <Probe />
      </AppStateProvider>,
    );

    await screen.findByText('Nine holds 0');

    expect(seen).toStrictEqual([null]);
  });

  it.each([401, 403])('reports a %i as the instance refusing the read', async (status) => {
    serveNine(status);
    const { job, dispatch, setLoaded } = jobOf(null);

    await fetchWhois(job);

    expect(dispatch).toHaveBeenCalledWith({ type: 'anonRefused', accountKey: ANON_KEY });
    expect(setLoaded).not.toHaveBeenCalled();
  });

  it('only prints any other failure', async () => {
    serveNine(404);
    const { job, dispatch } = jobOf(null);

    await fetchWhois(job);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'anonRefused' }));
  });

  it('leaves a refusal of a signed-in lookup to its own fallback', async () => {
    serveNine(403);
    const { job, dispatch } = jobOf('never-logged');

    await fetchWhois(job);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'anonRefused' }));
  });
});
