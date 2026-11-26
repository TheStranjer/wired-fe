/**
 * Tests for /poll: the tokenized line posts a draft carrying a poll. Quoted
 * question and options may carry spaces; `--multiple` and `--hours` are pulled
 * out of the option list wherever they sit, whole or fractional hours over the
 * default 24; the draft reaches the active window's post handler and success
 * prints `poll posted`. The error string the handler answers with comes back
 * as the command's failure. The refusals live in poll.refusals.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './poll';
import type { StoredAccount } from '../../accounts/accountStore';
import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  type FeatureFlag,
} from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { type AppState, coreReducer, initialAppState } from '../../state/appState';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The signed-in account the command acts as. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

/** The limits of an instance advertising {@link limits}. */
function capsWith(limits: Capabilities['pollLimits']): Capabilities {
  return {
    backend: 'wired',
    maxCharacters: 5_000,
    maxMediaAttachments: 6,
    pollLimits: limits,
    features: new Set<FeatureFlag>(['emojiReactions']),
  };
}

/** The stock Mastodon limits: 4 options of 50 characters, 5m–30d. */
const STOCK = capsWith(DEFAULT_POLL_LIMITS);

/** A context signed in as lain on an instance whose limits are {@link caps}. */
function wiredContext(caps: Capabilities, overrides: Partial<CommandContext> = {}): CommandContext {
  const signedIn = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const profile: InstanceProfile = { origin: ORIGIN, title: 'Wired', capabilities: caps };
  const state: AppState = coreReducer(signedIn, { type: 'profile', profile });
  return fakeCommandContext({ state, windows: state.windows, ...overrides });
}

describe('/poll', () => {
  it('posts a quoted question with two options for the default 24 hours', async () => {
    const context = wiredContext(STOCK);

    const outcome = await command.run('"Which way out?" "the wire" "the window"', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.post).toHaveBeenCalledWith({
      text: 'Which way out?',
      poll: { options: ['the wire', 'the window'], expiresIn: 86_400, multiple: false },
    });
    expect(context.print).toHaveBeenCalledWith('poll posted');
  });

  it('pulls flags out from between the options', async () => {
    const context = wiredContext(STOCK);

    const outcome = await command.run(
      '"Layers?" "real" --multiple --hours 6 "unreal" "both"',
      context,
    );

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.post).toHaveBeenCalledWith({
      text: 'Layers?',
      poll: { options: ['real', 'unreal', 'both'], expiresIn: 21_600, multiple: true },
    });
  });

  it('takes fractional hours', async () => {
    const context = wiredContext(STOCK);

    await command.run('"Close?" "yes" --hours 1.5 "no"', context);

    expect(context.post).toHaveBeenCalledWith({
      text: 'Close?',
      poll: { options: ['yes', 'no'], expiresIn: 5_400, multiple: false },
    });
  });

  it('reports what the post handler answers back', async () => {
    const context = wiredContext(STOCK, {
      post: vi.fn<CommandContext['post']>().mockResolvedValue("You can't post in this window"),
    });

    const outcome = await command.run('"q" "a" "b"', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "You can't post in this window",
    });
    expect(context.print).not.toHaveBeenCalled();
  });
});
