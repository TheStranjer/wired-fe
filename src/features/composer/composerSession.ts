/**
 * The session the composer window tests share (AGENTS.md "Testing"): lain on a
 * Wired instance that caps posts at thirty and serves the local audience, bob
 * on a Mastodon one that caps at twenty and does not, and a composer window
 * open posting as lain. Built through the real reducer, so a window sees what
 * the app would have shown it.
 */
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  type FeatureFlag,
} from '../../capabilities/capabilities';
import { type AppState, initialAppState } from '../../state/appState';
import { composerWindowOpen } from '../../state/composerWindow';
import { type AppAction, appReducer } from '../../state/reducer';

/** The two instances. */
export const WIRED = 'https://wired.example';
export const MASTO = 'https://mastodon.example';

/** An account of one instance. */
export function accountOf(origin: string, id: string, handle: string): StoredAccount {
  return {
    key: accountKey(origin, id),
    origin,
    accountId: id,
    handle,
    token: `token-${id}`,
    refreshToken: null,
    expiresAt: null,
  };
}

export const LAIN = accountOf(WIRED, '1', 'lain@wired.example');
export const BOB = accountOf(MASTO, '2', 'bob@mastodon.example');

/** What an instance serves: its post length and whether `local` is an audience. */
function capabilities(backend: Capabilities['backend'], max: number, local: boolean): Capabilities {
  return {
    backend,
    maxCharacters: max,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set<FeatureFlag>(local ? ['localOnlyPosts'] : []),
  };
}

/** A session signed in as lain and bob, with a composer open posting as lain. */
export function openedComposer(extra: readonly AppAction[] = []): AppState {
  const base: readonly AppAction[] = [
    { type: 'accounts', accounts: [LAIN, BOB], activeKey: LAIN.key },
    {
      type: 'profile',
      profile: { origin: WIRED, title: 'wired', capabilities: capabilities('wired', 30, true) },
    },
    {
      type: 'profile',
      profile: { origin: MASTO, title: 'masto', capabilities: capabilities('mastodon', 20, false) },
    },
  ];
  const signedIn = base.reduce(appReducer, initialAppState());
  const withComposer = appReducer(signedIn, {
    type: 'windows',
    action: composerWindowOpen(LAIN, signedIn.windows.windows),
  });
  return extra.reduce(appReducer, withComposer);
}
