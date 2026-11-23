/**
 * Tests for the label a post command names its post by: the active window's own
 * label for the line that shows the status, that same line's label when the
 * status is the original a boost carries, and the bare id for a status this
 * window never showed.
 */
import { describe, expect, it } from 'vitest';

import { printedLabel } from './statusLabel';
import type { CommandContext } from './types';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { type AppState, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { fakeCommandContext } from '../test/commandContext';
import { status } from '../test/fixtures';
import { type WindowRef, windowId } from '../windows/model';

const ORIGIN = 'https://wired.example';

/** The signed-in account whose home window shows the posts. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

/** Lain's home window: the active window whose label book is read. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

/** A post lain wrote, and a boost of it: the line shows the boost. */
const POST = status('p');

/** A boost of {@link POST}: its line carries the post the command resolves to. */
const BOOST = status('b', { reblog: POST });

/**
 * The original as the boost carries it: the status is parsed again on the way
 * in, so this copy — the one the target resolvers hand a command — is the
 * object whose line has to be found, not {@link POST} itself.
 */
const ORIGINAL = BOOST.reblog ?? POST;

/** The signed-in state with lain's home window showing {@link posts}. */
function homeState(posts: readonly Status[]): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(signedIn, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  return appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: posts,
    where: 'newer',
  });
}

/** A context whose active window shows {@link posts}. */
function homeContext(posts: readonly Status[]): CommandContext {
  const state = homeState(posts);
  return fakeCommandContext({ state, windows: state.windows });
}

describe(printedLabel, () => {
  it('names the line that shows the status by the label the window gave it', () => {
    expect(printedLabel(homeContext([POST]), POST)).toBe('a0');
  });

  it('names a boost line for the original it carries', () => {
    expect(printedLabel(homeContext([BOOST]), ORIGINAL)).toBe('a0');
  });

  it('answers with the bare id for a status this window never showed', () => {
    expect(printedLabel(homeContext([POST]), status('gone'))).toBe('gone');
  });
});
