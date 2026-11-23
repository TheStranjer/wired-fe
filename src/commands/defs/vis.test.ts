/**
 * Tests for /vis: no argument prints the reader's current default; every
 * accepted word dispatches the settings action and prints the new default back,
 * `followers` reading as `private`; anything else echoes the usage and touches
 * nothing; and `local` reaches only a signed-in account whose instance advertises
 * local-only posts (decision 5) — without the capability, or never detected,
 * the refusal names the server, not the account.
 */
import { describe, expect, it } from 'vitest';

import { command } from './vis';
import type { StoredAccount } from '../../accounts/accountStore';
import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  type FeatureFlag,
} from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { type AppState, initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The signed-in account commands act as. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

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

/** A context over fresh state whose settings are {@link settings}. */
function settingsContext(settings: Settings): CommandContext {
  const state = initialAppState(settings);
  return fakeCommandContext({ state, windows: state.windows });
}

/** The state signed in as lain, with {@link capabilities} detected or not. */
function signedInState(capabilities: Capabilities | null): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  return capabilities === null
    ? signedIn
    : appReducer(signedIn, {
        type: 'profile',
        profile: { origin: ORIGIN, title: 'Wired', capabilities } satisfies InstanceProfile,
      });
}

/** A context signed in as lain on an instance advertising {@link flags}. */
function wiredContext(flags: readonly FeatureFlag[]): CommandContext {
  const state = signedInState(capsWith(...flags));
  return fakeCommandContext({ state, windows: state.windows });
}

describe('/vis', () => {
  it('prints the current default when given no argument', async () => {
    const context = settingsContext({ ...DEFAULT_SETTINGS, defaultVisibility: 'direct' });

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith('New posts are direct by default');
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('sets a valid visibility and prints it back', async () => {
    const context = settingsContext(DEFAULT_SETTINGS);

    const outcome = await command.run('unlisted', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { defaultVisibility: 'unlisted' },
    });
    expect(context.print).toHaveBeenCalledWith('New posts are unlisted by default');
  });

  it('reads followers as private', async () => {
    const context = settingsContext(DEFAULT_SETTINGS);

    const outcome = await command.run('followers', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { defaultVisibility: 'private' },
    });
    expect(context.print).toHaveBeenCalledWith('New posts are private by default');
  });

  it.each(['nonsense', 'PUBLIC', 'public extra', '"public"'])(
    'echoes the usage for %s',
    async (args) => {
      const context = settingsContext(DEFAULT_SETTINGS);

      const outcome = await command.run(args, context);

      expect(outcome).toStrictEqual({
        ok: false,
        message: 'Usage: /vis [public|unlisted|private|direct|local]',
      });
      expect(context.dispatch).not.toHaveBeenCalled();
      expect(context.print).not.toHaveBeenCalled();
    },
  );

  it('sets local on a server that has the capability', async () => {
    const context = wiredContext(['localOnlyPosts']);

    const outcome = await command.run('local', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { defaultVisibility: 'local' },
    });
    expect(context.print).toHaveBeenCalledWith('New posts are local by default');
  });

  it('refuses local on a server without the capability', async () => {
    const context = wiredContext([]);

    const outcome = await command.run('local', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'This server has no local-only posts' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses local while no instance was ever detected', async () => {
    const context = fakeCommandContext();

    const outcome = await command.run('local', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'This server has no local-only posts' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });
});
