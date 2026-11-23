/**
 * Tests for the content links in the shared post line (WFE-156): clicking a
 * hashtag or a mention in a post's body opens that tag's or account's window
 * for the window's own account, instead of leaving for the backend's page; a
 * link the status does not name as a mention or a tag is left to the browser.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { PostLine } from './PostLine';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { status } from '../test/fixtures';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;

/** The account the home window under test belongs to. */
const ACCOUNT: StoredAccount = {
  key: ACCOUNT_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};

/** The home window on {@link ACCOUNT}, and the id its ref names. */
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** A post that carries a hashtag, a mention and a link nobody resolved. */
const POST: Status = status('p1', {
  content:
    '<p><a href="https://wired.example/tags/rust">#rust</a> ' +
    '<a href="https://wired.example/users/ally">@ally</a> ' +
    '<a href="https://other.example/page">elsewhere</a></p>',
  mentions: [{ id: 'a9', username: 'ally', acct: 'ally', url: 'https://wired.example/users/ally' }],
  tags: [{ name: 'Rust', url: 'https://wired.example/tags/rust' }],
});

/** The signed-in home window, with {@link POST} not yet in any buffer. */
function seeded(): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  return coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
}

/** Every window the state holds as `kind title target account`, one span each. */
function Windows(): JSX.Element {
  const state = useAppState();
  return (
    <section aria-label="windows">
      {state.windows.windows.map((win) => (
        <span key={win.id}>
          {`${win.ref.kind} ${win.title} ${win.ref.target ?? '-'} ${win.ref.accountKey ?? '-'}`}
        </span>
      ))}
    </section>
  );
}

/** Render {@link POST} as a line of the window `id`, then click the named link;
 * false when the click's default was prevented. */
function clickLink(name: string, id = HOME): boolean {
  render(
    <AppStateProvider initial={seeded()}>
      <PostLine lineKey="p1" status={POST} windowId={id} />
      <Windows />
    </AppStateProvider>,
  );
  return fireEvent.click(screen.getByRole('link', { name }));
}

describe(PostLine, () => {
  it('opens the hashtag window for the window account when a hashtag is clicked', () => {
    const proceeded = clickLink('#rust');

    expect(proceeded).toBe(false);
    expect(screen.getByRole('region', { name: 'windows' })).toHaveTextContent(
      `hashtag #rust rust ${ACCOUNT_KEY}`,
    );
  });

  it('opens the profile window of the mentioned account when a mention is clicked', () => {
    const proceeded = clickLink('@ally');

    expect(proceeded).toBe(false);
    expect(screen.getByRole('region', { name: 'windows' })).toHaveTextContent(
      `profile @ally a9 ${ACCOUNT_KEY}`,
    );
  });

  it('leaves a link the status does not name to the browser', () => {
    const proceeded = clickLink('elsewhere');

    expect(proceeded).toBe(true);
    expect(screen.getByRole('region', { name: 'windows' })).not.toHaveTextContent('hashtag');
    expect(screen.getByRole('region', { name: 'windows' })).not.toHaveTextContent('profile');
  });

  it('leaves a hashtag to the browser when no account owns the window', () => {
    const proceeded = clickLink('#rust', 'no-such-window');

    expect(proceeded).toBe(true);
    expect(screen.getByRole('region', { name: 'windows' })).not.toHaveTextContent('hashtag');
  });
});
