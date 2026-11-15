/**
 * Tests for /about: the full report of a Wired profile, the Mastodon case
 * whose only feature is editing, the `none` and second-scale durations of a
 * pleroma that advertises nothing, and the refusal when no account is signed
 * in or its origin was never detected.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './about';
import type { StoredAccount } from '../../accounts/accountStore';
import {
  type Capabilities,
  type FeatureFlag,
  DEFAULT_POLL_LIMITS,
} from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { type AppState, coreReducer, initialAppState } from '../../state/appState';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The signed-in account every connected test runs as. */
const ACCOUNT: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
};

/** A Wired instance: generous posts, a year of polls, its own feature set. */
const WIRED: Capabilities = {
  backend: 'wired',
  maxCharacters: 5_000,
  maxMediaAttachments: 6,
  pollLimits: {
    maxOptions: 20,
    maxCharactersPerOption: 200,
    minExpiration: 300,
    maxExpiration: 31_536_000,
  },
  features: new Set<FeatureFlag>(['emojiReactions', 'localOnlyPosts', 'markdown']),
};

/** A Mastodon.org-style instance: the defaults, and editing as its only flag. */
const MASTODON: Capabilities = {
  backend: 'mastodon',
  maxCharacters: 500,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set<FeatureFlag>(['editing']),
};

/** A pleroma that advertises nothing: no flags, an hour of polls from zero. */
const PLEROMA: Capabilities = {
  backend: 'pleroma',
  maxCharacters: 1_000,
  maxMediaAttachments: 2,
  pollLimits: { maxOptions: 4, maxCharactersPerOption: 50, minExpiration: 0, maxExpiration: 3_600 },
  features: new Set<FeatureFlag>([]),
};

/** What the account's instance turned out to be: {@link capabilities}, titled. */
function profileAt(title: string, capabilities: Capabilities): InstanceProfile {
  return { origin: ORIGIN, title, capabilities };
}

/** The state {@link ACCOUNT} signs into, with {@link profile} stored if given. */
function signedInState(profile: InstanceProfile | null): AppState {
  const signedIn = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  return profile === null ? signedIn : coreReducer(signedIn, { type: 'profile', profile });
}

/** A context whose state is {@link state} and whose print records its calls. */
function stubContext(state: AppState): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ state, print }), print };
}

describe('/about', () => {
  it('prints the full report of a Wired profile', async () => {
    const { context, print } = stubContext(signedInState(profileAt('Wired Example', WIRED)));

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([
      ['Wired Example at https://wired.example'],
      ['  backend: wired'],
      ['  posts: up to 5000 characters, 6 attachments'],
      ['  polls: 20 options of 200 characters, 5m–365d'],
      ['  features: emojiReactions, localOnlyPosts, markdown'],
    ]);
  });

  it('prints a Mastodon profile whose only feature is editing', async () => {
    const { context, print } = stubContext(signedInState(profileAt('mastodon.social', MASTODON)));

    const outcome = await command.run('anything at all', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([
      ['mastodon.social at https://wired.example'],
      ['  backend: mastodon'],
      ['  posts: up to 500 characters, 4 attachments'],
      ['  polls: 4 options of 50 characters, 5m–30d'],
      ['  features: editing'],
    ]);
  });

  it('prints none and small-scale durations for a pleroma advertising nothing', async () => {
    const { context, print } = stubContext(signedInState(profileAt('pleroma.example', PLEROMA)));

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([
      ['pleroma.example at https://wired.example'],
      ['  backend: pleroma'],
      ['  posts: up to 1000 characters, 2 attachments'],
      ['  polls: 4 options of 50 characters, 0s–1h'],
      ['  features: none'],
    ]);
  });

  it('refuses while nobody is signed in', async () => {
    const { context, print } = stubContext(initialAppState());

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not connected. Type /connect' });
    expect(print).not.toHaveBeenCalled();
  });

  it('refuses while the account origin was never detected', async () => {
    const { context, print } = stubContext(signedInState(null));

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not connected. Type /connect' });
    expect(print).not.toHaveBeenCalled();
  });
});
