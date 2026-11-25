/**
 * Shared setup for the card confirmation tests (WFE-266, WFE-267): a home
 * window holding one post, lines marked `confirm` for the rows under test, a
 * renderer that returns the spy the app's runner is, and a helper that chooses
 * a `⋯` row.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { PostActionsProvider } from './PostActionsContext';
import type { PostActions } from './PostActionsContext';
import { PostLine } from './PostLine';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
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

/** Lines for the rows under test, as the registry would build them for `a0`. */
const LINES: ReturnType<PostActions['linesFor']> = {
  delete: { line: '/delete a0', prefill: false, confirm: 'delete' },
  block: { line: '/block a0', prefill: false, confirm: 'block' },
  mute: { line: '/mute a0', prefill: false, confirm: 'mute' },
  quote: { line: '/quote a0', prefill: false },
};

/** The home window holding just {@link post}, which gets the label `a0`. */
function seeded(post: Status): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  const opened = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  return appReducer(opened, { type: 'statuses', windowId: HOME, statuses: [post], where: 'newer' });
}

/** Render one card for {@link post}; the returned `run` records what the app is asked to run. */
export function renderCard(post: Status): PostActions['run'] {
  const run = vi.fn<PostActions['run']>();
  const actions: PostActions = { linesFor: () => LINES, run };
  render(
    <PostActionsProvider actions={actions}>
      <AppStateProvider initial={seeded(post)}>
        <PostLine lineKey="a0" status={post} windowId={HOME} />
      </AppStateProvider>
    </PostActionsProvider>,
  );
  return run;
}

/** Open the card's `⋯` menu and choose the row named {@link row}. */
export function choose(row: string): void {
  fireEvent.click(screen.getByRole('button', { name: /^More actions for post / }));
  fireEvent.click(screen.getByRole('menuitem', { name: row }));
}
