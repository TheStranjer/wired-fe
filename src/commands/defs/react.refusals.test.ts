/**
 * Refusal tests for /react: every one comes back before any request, so no
 * handler is registered and any network call would fail the test. An
 * instance without `emojiReactions` refuses any reaction; one without
 * `customEmojiReactions` refuses a `:shortcode:` but not a Unicode emoji;
 * capabilities that were never read refuse as though `emojiReactions` were
 * absent; and an argument with no single emoji word echoes the usage.
 */
import { describe, expect, it } from 'vitest';

import { command } from './react';
import type { StoredAccount } from '../../accounts/accountStore';
import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  type FeatureFlag,
} from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { type AppState, initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { status } from '../../test/fixtures';
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
};

/** Lain's home window: the active window the target resolver reads. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

/** A post for the scrollback; the refusals never reach its reaction path. */
const POST = status('p');

/** The instance advertising only {@link flags}. */
function capsWith(...flags: readonly FeatureFlag[]): Capabilities {
  return {
    backend: 'pleroma',
    maxCharacters: 5000,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set<FeatureFlag>(flags),
  };
}

/**
 * The signed-in state with lain's home window showing {@link POST}, the
 * instance {@link capabilities} — or, when it is null, never detected.
 */
function homeContext(capabilities: Capabilities | null): CommandContext {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const withProfile =
    capabilities === null
      ? signedIn
      : appReducer(signedIn, {
          type: 'profile',
          profile: { origin: ORIGIN, title: 'Wired', capabilities } satisfies InstanceProfile,
        });
  const opened = appReducer(withProfile, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const state: AppState = appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: [POST],
    where: 'newer',
  });
  return fakeCommandContext({ state, windows: state.windows });
}

describe('/react refusals', () => {
  it('refuses any reaction on an instance without emojiReactions', async () => {
    const context = homeContext(capsWith());

    const outcome = await command.run('a0 🔥', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Instance lacks emojiReactions' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses a shortcode on an instance without customEmojiReactions', async () => {
    const context = homeContext(capsWith('emojiReactions'));

    const outcome = await command.run('a0 :blob:', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Instance lacks customEmojiReactions' });
  });

  it('refuses as though without emojiReactions when none was ever detected', async () => {
    const context = homeContext(null);

    const outcome = await command.run('a0 🔥', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Instance lacks emojiReactions' });
  });

  it('echoes the usage when the emoji is missing', async () => {
    const context = homeContext(capsWith('emojiReactions'));

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Usage: /react [label] <emoji>' });
  });

  it('echoes the usage when more than one word follows the label', async () => {
    const context = homeContext(capsWith('emojiReactions'));

    const outcome = await command.run('a0 🔥 extra', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Usage: /react [label] <emoji>' });
  });
});
