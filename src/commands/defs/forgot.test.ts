/**
 * Tests for /forgot: an `name@host` argument goes out as an e-mail address and
 * anything else (a leading `@` and host dropped) as a nickname, over MSW; the
 * same line is printed on a 204 and on an error; the instance comes from the
 * typed word, the active account or the build; an empty argument or an
 * unusable instance is refused without a request.
 */
import { HttpResponse, http } from 'msw';
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './forgot';
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import { coreReducer, initialAppState } from '../../state/appState';
import { fakeCommandContext } from '../../test/commandContext';
import { server } from '../../test/server';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';
const LETTER = 'If that account exists, a reset letter is on its way.';

/** Answers `POST <origin>/auth/password` with {@link status}, recording every body into the returned list. */
function answer(origin: string, status: number): unknown[] {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${origin}/auth/password`, async ({ request }) => {
      bodies.push(await request.json());
      return status === 204
        ? new HttpResponse(null, { status })
        : HttpResponse.json({ error: 'nope' }, { status });
    }),
  );
  return bodies;
}

/** A context whose print records its calls, over {@link overrides}. */
function stub(overrides: Partial<CommandContext> = {}): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ print, ...overrides }), print };
}

describe('/forgot', () => {
  it.each([
    ['lain@example.com', { email: 'lain@example.com' }],
    ['lain', { nickname: 'lain' }],
    ['@lain', { nickname: 'lain' }],
    ['@lain@wired.example', { nickname: 'lain' }],
  ])('sends %s as %j', async (typed, body) => {
    const bodies = answer(ORIGIN, 204);
    const { context, print } = stub();

    const outcome = await command.run(typed, context);

    expect(bodies).toStrictEqual([body]);
    expect(print).toHaveBeenCalledExactlyOnceWith(LETTER);
    expect(outcome).toStrictEqual({ ok: true });
  });

  it('prints the same line when the instance refuses', async () => {
    const bodies = answer(ORIGIN, 400);
    const { context, print } = stub();

    const outcome = await command.run('lain', context);

    expect(bodies).toHaveLength(1);
    expect(print).toHaveBeenCalledExactlyOnceWith(LETTER);
    expect(outcome).toStrictEqual({ ok: true });
  });

  it('prints the same line when the request fails to reach the instance', async () => {
    server.use(http.post(`${ORIGIN}/auth/password`, () => HttpResponse.error()));
    const { context, print } = stub();

    await command.run('lain', context);

    expect(print).toHaveBeenCalledExactlyOnceWith(LETTER);
  });

  it('refuses an empty argument without a request', async () => {
    const bodies = answer(ORIGIN, 204);
    const { context, print } = stub();

    const outcome = await command.run('  ', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Usage: /forgot <email|nick>' });
    expect(bodies).toHaveLength(0);
    expect(print).not.toHaveBeenCalled();
  });

  it('asks the active account’s instance when signed in', async () => {
    const origin = 'https://other.example';
    const account: StoredAccount = {
      key: accountKey(origin, '1'),
      origin,
      accountId: '1',
      handle: 'me@other.example',
      token: 'never-logged',
      refreshToken: null,
      expiresAt: null,
    };
    const state = coreReducer(initialAppState(), {
      type: 'accounts',
      accounts: [account],
      activeKey: account.key,
    });
    const bodies = answer(origin, 204);
    const { context } = stub({ state });

    await command.run('lain', context);

    expect(bodies).toStrictEqual([{ nickname: 'lain' }]);
  });

  it('takes the instance typed after the target on an open build', async () => {
    const bodies = answer('https://typed.example', 204);
    const { context } = stub({ config: { appName: 'WiredFE', instances: { mode: 'open' } } });

    const outcome = await command.run('lain typed.example', context);

    expect(bodies).toStrictEqual([{ nickname: 'lain' }]);
    expect(outcome).toStrictEqual({ ok: true });
  });

  it('asks for an instance on an open build that has none', async () => {
    const { context, print } = stub({
      config: { appName: 'WiredFE', instances: { mode: 'open' } },
    });

    const outcome = await command.run('lain', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Enter an instance, like wired.example' });
    expect(print).not.toHaveBeenCalled();
  });
});
