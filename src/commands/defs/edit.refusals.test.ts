/**
 * Refusal tests for /edit: every one comes back before any request, so no
 * handler is registered and any network call would fail the test. A post of
 * somebody else's — the original of a boost included — is not this account's to
 * revise, and the author check comes first: an instance that does support
 * editing still refuses it. An instance that does not advertise `editing`
 * refuses, the same way one that was never detected does (decision 5), and it
 * refuses a fill with no text on the line just as it refuses a send.
 */
import { describe, expect, it } from 'vitest';

import { command } from './edit';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  type FeatureFlag,
} from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { type AppState, initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { status, TEST_DATE } from '../../test/fixtures';
import { type WindowRef, windowId } from '../../windows/model';
import type { CommandContext } from '../types';

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

/** Lain's home window: the active window the target resolver reads. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

/** The twelve wire fields of the account that wrote {@link HERS}. */
const ALICE_WIRE = {
  id: '2',
  username: 'alice',
  acct: 'alice@wired.example',
  display_name: 'Alice',
  created_at: TEST_DATE,
  note: '',
  url: 'https://wired.example/@alice',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** Lain's own post, one alice wrote, and lain's boost of alice's post. */
const MINE = status('p');

const HERS = status('q', { account: ALICE_WIRE });

const HER_BOOST = status('b', { reblog: HERS });

/** The instance advertising only {@link flags}. */
function capsWith(...flags: readonly FeatureFlag[]): Capabilities {
  return {
    backend: 'wired',
    maxCharacters: 5000,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set<FeatureFlag>(flags),
  };
}

/**
 * The signed-in state with lain's home window showing {@link posts} on an
 * instance {@link capabilities} — or, when it is null, never detected.
 */
function homeContext(posts: readonly Status[], capabilities: Capabilities | null): CommandContext {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const detected =
    capabilities === null
      ? signedIn
      : appReducer(signedIn, {
          type: 'profile',
          profile: {
            origin: ORIGIN,
            title: 'Wired',
            capabilities,
          } satisfies InstanceProfile,
        });
  const opened = appReducer(detected, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const state: AppState = appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: posts,
    where: 'newer',
  });
  return fakeCommandContext({ state, windows: state.windows });
}

describe('/edit refusals', () => {
  it('refuses a post of somebody else and sends nothing', async () => {
    const context = homeContext([HERS], capsWith('editing'));

    const outcome = await command.run('a0 new text', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'You can only edit your own posts' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
    expect(context.setInput).not.toHaveBeenCalled();
  });

  it('refuses the original of a boost of somebody else post', async () => {
    const context = homeContext([HER_BOOST], capsWith('editing'));

    const outcome = await command.run('a0 new text', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'You can only edit your own posts' });
  });

  it('refuses a fill as well as a send on an instance that lacks the capability', async () => {
    const context = homeContext([MINE], capsWith('localOnlyPosts'));

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "@lain@wired.example's server (Wired) can't edit posts",
    });
    expect(context.setInput).not.toHaveBeenCalled();
  });

  it('refuses an instance that was never detected', async () => {
    const context = homeContext([MINE], null);

    const outcome = await command.run('a0 new text', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "@lain@wired.example's server can't edit posts",
    });
  });
});
