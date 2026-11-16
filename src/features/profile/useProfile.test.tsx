/**
 * Tests for the profile loader: the window's target and account drive one
 * getAccount + relationships([id]) fetch (MSW-backed) whose answer maps onto
 * the whois props — the handle completed against the window's origin, joined
 * cut to its day, fields verified by their stamp, relationships off without
 * one. A failed lookup prints its description into the window; a failed
 * relationship check keeps the account; no target and no account mean no
 * request at all; and a fetch whose window closed reports nothing.
 */
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { fetchWhois, useProfile, type WhoisJob } from './useProfile';
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../../state/appState';
import { AppStateProvider, type Dispatch } from '../../state/StateContext';
import { server } from '../../test/server';
import type { WhoisBlockProps } from '../../ui/WhoisBlock';
import { BufferView } from '../../views/BufferView';
import { type WindowRef, windowId } from '../../windows/model';

const ORIGIN = 'https://wired.example';

const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};

/** Nine's profile window on the signed-in account, and one with no target. */
const REF: WindowRef = { kind: 'profile', accountKey: ACCOUNT.key, target: '9' };
const WINDOW = windowId(REF);
const NO_TARGET = windowId({ ...REF, target: null });

/** Nine's wire shape: local acct, so the handle needs the origin to complete. */
const NINE_WIRE = {
  id: '9',
  username: 'nine',
  acct: 'nine',
  display_name: 'Nine',
  created_at: '2024-01-02T10:00:00.000Z',
  note: '',
  url: 'https://wired.example/@nine',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 300,
  following_count: 80,
  statuses_count: 120,
  fields: [
    { name: 'site', value: 'https://example.org', verified_at: '2024-02-03T00:00:00.000Z' },
    { name: 'pronouns', value: 'none', verified_at: null },
  ],
};

/** The session with {@link REF}'s window open, signed in unless {@link null}. */
function opened(account: StoredAccount | null): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: account === null ? [] : [account],
    activeKey: account === null ? null : account.key,
  });
  return coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: '@nine' },
  });
}

/** What the hook returned, spelled out for the assertions. */
function Probe(props: { readonly whois: WhoisBlockProps | null }): JSX.Element {
  const whois = props.whois;
  if (whois === null) {
    return <span>nothing</span>;
  }
  const held = Object.entries(whois.relationships)
    .filter(([, holds]) => holds)
    .map(([flag]) => flag)
    .join(',');
  return (
    <section aria-label="whois">
      {`${whois.displayName} @${whois.handle} joined ${whois.joined}, `}
      {`fields ${whois.fields.map((field) => `${field.name}:${String(field.verified)}`).join(' ')}; `}
      {`posts ${String(whois.counts.posts)}; holds ${held === '' ? 'nothing' : held}`}
    </section>
  );
}

/** Calls the hook on every render and hands the answer to {@link Probe}. */
function WhoisHost(props: { readonly windowId: string }): JSX.Element {
  return <Probe whois={useProfile(props.windowId)} />;
}

/** The hook over {@link state}, its window's scrollback along for the prints. */
function Host(props: { readonly windowId: string; readonly state: AppState }): JSX.Element {
  const { windowId: id, state } = props;
  return (
    <AppStateProvider initial={state}>
      <WhoisHost windowId={id} />
      <BufferView label="profile" windowId={id} />
    </AppStateProvider>
  );
}

/** Serve nine's account; the relationship comes full, empty or refused. */
function serveNine(relationship: 'full' | 'none' | 'failed'): void {
  server.use(
    http.get(`${ORIGIN}/api/v1/accounts/9`, () => {
      return HttpResponse.json(NINE_WIRE);
    }),
    http.get(`${ORIGIN}/api/v1/accounts/relationships`, ({ request }) => {
      expect(new URL(request.url).searchParams.getAll('id[]')).toContain('9');

      if (relationship === 'failed') {
        return HttpResponse.json({ error: 'no' }, { status: 500 });
      }
      if (relationship === 'none') {
        return HttpResponse.json([]);
      }
      return HttpResponse.json([
        { id: '9', following: true, followed_by: true, blocking: false, muting: true },
      ]);
    }),
  );
}

describe(useProfile, () => {
  it('maps the fetched account and the relationship onto whois props', async () => {
    serveNine('full');
    render(<Host windowId={WINDOW} state={opened(ACCOUNT)} />);

    await screen.findByText(/posts 120; holds following,followedBy,muted/u);

    expect(screen.getByText(/Nine @nine@wired\.example joined 2024-01-02/u)).toBeInTheDocument();
    expect(screen.getByText(/site:true pronouns:false/u)).toBeInTheDocument();
  });

  it('holds no relationship when the instance answers with none', async () => {
    serveNine('none');
    render(<Host windowId={WINDOW} state={opened(ACCOUNT)} />);

    await screen.findByText(/holds nothing/u);

    expect(screen.getByText(/Nine @nine@wired\.example/u)).toBeInTheDocument();
  });

  it('keeps the account when only the relationship check fails', async () => {
    serveNine('failed');
    render(<Host windowId={WINDOW} state={opened(ACCOUNT)} />);

    await screen.findByText(/Nine @nine@wired\.example/u);

    expect(screen.getByText(/holds nothing/u)).toBeInTheDocument();
  });

  it('prints a failed lookup into the window and shows no whois block', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/9`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );
    render(<Host windowId={WINDOW} state={opened(ACCOUNT)} />);

    await screen.findByText('HTTP 404: Record not found');

    expect(screen.getByText('nothing')).toBeInTheDocument();
  });

  it('asks for nothing when the window has no target', () => {
    // No handlers are registered: any request would fail this test.
    render(<Host windowId={NO_TARGET} state={opened(ACCOUNT)} />);

    expect(screen.getByText('nothing')).toBeInTheDocument();
  });

  it('asks for nothing when the window has no account', () => {
    render(<Host windowId={WINDOW} state={opened(null)} />);

    expect(screen.getByText('nothing')).toBeInTheDocument();
  });

  it('reports nothing once the window it answers has closed', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/9`, () => {
        return HttpResponse.json(NINE_WIRE);
      }),
    );
    const controller = new AbortController();
    controller.abort();
    const dispatch = vi.fn<Dispatch>();
    const setLoaded = vi.fn<WhoisJob['setLoaded']>();

    await fetchWhois({
      session: { origin: ORIGIN, token: 'never-logged' },
      id: '9',
      windowId: WINDOW,
      signal: controller.signal,
      dispatch,
      setLoaded,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(setLoaded).not.toHaveBeenCalled();
  });
});
