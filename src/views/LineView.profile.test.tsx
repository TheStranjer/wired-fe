/**
 * Tests for the nick click in the shared line views (WFE-106): clicking a
 * post row's nick asks the real reducer to open the author's profile window,
 * titled `@<acct>` and owned by the row's window's account — the boosted
 * original's author for a boost — and the click stays off the row's own
 * selection.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { LineView } from './LineView';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import type { PostLineData } from '../state/buffer';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { TEST_DATE, status } from '../test/fixtures';
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
  refreshToken: null,
  expiresAt: null,
};

/** The home window on {@link ACCOUNT}, and the id its ref names. */
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** Somebody else's account, as the boosted original's author. */
const NINE = {
  id: '9',
  username: 'nine',
  acct: 'nine@pleroma.example',
  display_name: 'Nine',
  created_at: TEST_DATE,
  note: '<p>not lain</p>',
  url: 'https://pleroma.example/@nine',
  avatar: 'https://pleroma.example/avi.png',
  header: 'https://pleroma.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** The signed-in home window showing {@link posts}. */
function seeded(posts: readonly Status[]): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  const opened = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  return appReducer(opened, { type: 'statuses', windowId: HOME, statuses: posts, where: 'newer' });
}

/** The window titles the state holds, one span per window. */
function WindowTitles(): JSX.Element {
  const state = useAppState();
  return (
    <section aria-label="windows">
      {state.windows.windows.map((win) => (
        <span key={win.id}>{win.title}</span>
      ))}
    </section>
  );
}

/** The home buffer's first post line; the setup fails without one. */
function postLine(state: AppState): PostLineData {
  const line = bufferFor(state, HOME).lines.find(
    (entry): entry is PostLineData => entry.kind === 'post',
  );
  if (line === undefined) {
    throw new Error('the home buffer holds no post line');
  }
  return line;
}

/** Render the row and the window titles over {@link state}, then click a nick. */
function clickNick(state: AppState, nickName: string): void {
  render(
    <AppStateProvider initial={state}>
      <LineView line={postLine(state)} windowId={HOME} />
      <WindowTitles />
    </AppStateProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: nickName }));
}

describe('the profile window a nick click opens', () => {
  it('opens the author profile window when the nick is clicked', () => {
    clickNick(seeded([status('a')]), '@lain@wired.example');

    expect(screen.getByRole('region', { name: 'windows' })).toHaveTextContent(
      '@lain@wired.example',
    );
    expect(screen.getByRole('article')).not.toHaveAttribute('aria-current');
  });

  it('opens the boosted author profile window when the nick is clicked', () => {
    const boosted = status('boost', { reblog: status('orig', { account: NINE }) });

    clickNick(seeded([boosted]), '@nine@pleroma.example');

    expect(screen.getByRole('region', { name: 'windows' })).toHaveTextContent(
      '@nine@pleroma.example',
    );
  });
});
