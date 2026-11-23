/**
 * Refusal tests for /poll: every one comes back before any draft is posted.
 * Grammar breaks — no arguments, a blank or empty question, an unterminated
 * quote — echo the usage; `--hours` names what it wants and an unknown flag
 * names itself. Each limit break quotes the acting account's instance numbers
 * back: the option count, the option that is too long, and the span a run
 * must fit (decision 5); an instance with its own limits is checked against
 * those. Without a signed-in, detected account the command refuses to connect.
 */
import { describe, expect, it } from 'vitest';

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
function wiredContext(caps: Capabilities): CommandContext {
  const signedIn = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const profile: InstanceProfile = { origin: ORIGIN, title: 'Wired', capabilities: caps };
  const state: AppState = coreReducer(signedIn, { type: 'profile', profile });
  return fakeCommandContext({ state, windows: state.windows });
}

/** An option {@link length} characters long. */
function longOption(length: number): string {
  return 'x'.repeat(length);
}

describe('/poll refusals', () => {
  it.each([
    ['no arguments at all', ''],
    ['blank arguments', '   '],
    ['an empty question', '"" "a" "b"'],
    ['an unterminated quote', '"q" "a" "b'],
  ])('echoes the usage for %s', async (_name, args) => {
    const context = wiredContext(STOCK);

    const outcome = await command.run(args, context);

    expect(outcome).toStrictEqual({ ok: false, message: `Usage: ${command.usage}` });
    expect(context.post).not.toHaveBeenCalled();
  });

  it.each([
    ['a word', '"q" "a" "b" --hours soon'],
    ['nothing behind it', '"q" "a" "b" --hours'],
    ['a non-positive number', '"q" "a" "b" --hours 0'],
  ])('refuses --hours given %s', async (_name, args) => {
    const context = wiredContext(STOCK);

    const outcome = await command.run(args, context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: '--hours wants a positive number of hours',
    });
    expect(context.post).not.toHaveBeenCalled();
  });

  it('refuses an unknown flag', async () => {
    const context = wiredContext(STOCK);

    const outcome = await command.run('"q" "a" --secret "b"', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Unknown flag: --secret' });
    expect(context.post).not.toHaveBeenCalled();
  });

  it.each([
    ['one option', '"q" "only one"', 'A poll needs 2–4 options'],
    ['no options', '"q"', 'A poll needs 2–4 options'],
    ['more options than allowed', '"q" "a" "b" "c" "d" "e"', 'A poll needs 2–4 options'],
    [
      'an option past the character limit',
      `"q" "a" "${longOption(51)}"`,
      `Option "${longOption(51)}" is longer than 50 characters`,
    ],
    [
      'a run shorter than the minimum',
      '"q" "a" "b" --hours 0.05',
      'Poll must run between 5m and 30d',
    ],
    [
      'a run longer than the maximum',
      '"q" "a" "b" --hours 1000',
      'Poll must run between 5m and 30d',
    ],
  ])('refuses %s by name', async (_name, args, message) => {
    const context = wiredContext(STOCK);

    const outcome = await command.run(args, context);

    expect(outcome).toStrictEqual({ ok: false, message });
    expect(context.post).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });

  it('checks against the instance’s own limits', async () => {
    const context = wiredContext(
      capsWith({
        maxOptions: 3,
        maxCharactersPerOption: 5,
        minExpiration: 3_600,
        maxExpiration: 86_400,
      }),
    );

    const tooMany = await command.run('"q" "a" "b" "c" "d"', context);

    expect(tooMany).toStrictEqual({ ok: false, message: 'A poll needs 2–3 options' });

    const tooLong = await command.run('"q" "ab" "abcdef"', context);

    expect(tooLong).toStrictEqual({
      ok: false,
      message: 'Option "abcdef" is longer than 5 characters',
    });

    const tooSoon = await command.run('"q" "a" "b" --hours 0.5', context);

    expect(tooSoon).toStrictEqual({ ok: false, message: 'Poll must run between 1h and 1d' });
    expect(context.post).not.toHaveBeenCalled();
  });

  it('refuses while nobody is signed in', async () => {
    const context = fakeCommandContext();

    const outcome = await command.run('"q" "a" "b"', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not connected. Type /connect' });
    expect(context.post).not.toHaveBeenCalled();
  });

  it('refuses while the instance was never detected', async () => {
    const state = coreReducer(initialAppState(), {
      type: 'accounts',
      accounts: [LAIN],
      activeKey: LAIN.key,
    });
    const context = fakeCommandContext({ state, windows: state.windows });

    const outcome = await command.run('"q" "a" "b"', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not connected. Type /connect' });
    expect(context.post).not.toHaveBeenCalled();
  });
});
