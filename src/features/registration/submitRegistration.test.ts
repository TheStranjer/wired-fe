/**
 * Tests for sending the sign-up form (decision 3, decision 8): a same-origin
 * build registers on the page's origin whatever was typed as the instance, a
 * `list` or `open` build on the typed one (and an unusable one is refused
 * before any request), the fields are trimmed but the password is not, and a
 * registration that signs the new account in is adopted into the session.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import {
  type RegistrationEnv,
  type RegistrationValues,
  submitRegistration,
} from './submitRegistration';
import { createAccountStore } from '../../accounts/accountStore';
import type { WiredConfig } from '../../config/schema';
import { err } from '../../lib/result';
import type { Dispatch } from '../../state/StateContext';
import { createStore } from '../../storage/store';
import { memoryBackend } from '../../test/memoryBackend';
import { ORIGIN, mockRegistration } from '../../test/registrationServer';

const VALUES: RegistrationValues = {
  instance: '',
  username: ' lain ',
  email: ' lain@example.com ',
  password: ' correct horse ',
  agreement: true,
  reason: ' a friend invited me ',
};

/** A build config in {@link mode}, with `https://wired.example` among the listed origins. */
function configOf(instances: WiredConfig['instances']): WiredConfig {
  return { appName: 'WiredFE', instances };
}

/** An environment on a page at {@link ORIGIN}, over fresh stores and recording dispatch. */
function envOf(config: WiredConfig): RegistrationEnv & { readonly dispatch: Mock<Dispatch> } {
  return {
    token: 'invite-1',
    config,
    page: { origin: ORIGIN, pathname: '/' },
    apps: createStore('submit-apps', memoryBackend()),
    accounts: createAccountStore(createStore('submit-accounts', memoryBackend())),
    dispatch: vi.fn<Dispatch>(),
    detect: vi.fn<RegistrationEnv['detect']>().mockResolvedValue(err({ kind: 'aborted' })),
    locale: 'de',
    now: () => new Date(1_700_000_000_000),
  };
}

describe(submitRegistration, () => {
  it('registers on the page origin of a same-origin build, trimming all but the password', async () => {
    const seen = mockRegistration({ accounts: { body: { approval_required: true } } });

    const outcome = await submitRegistration(
      { ...VALUES, instance: 'https://elsewhere.example' },
      envOf(configOf({ mode: 'same-origin' })),
    );

    expect(outcome).toStrictEqual({ kind: 'approval' });
    expect(seen.body).toStrictEqual({
      username: 'lain',
      email: 'lain@example.com',
      password: ' correct horse ',
      agreement: true,
      locale: 'de',
      reason: 'a friend invited me',
      token: 'invite-1',
    });
  });

  it('registers on the typed instance of an open build', async () => {
    const seen = mockRegistration({ accounts: { body: { confirmation_required: true } } });

    const outcome = await submitRegistration(
      { ...VALUES, instance: 'wired.example' },
      envOf(configOf({ mode: 'open' })),
    );

    expect(outcome).toStrictEqual({ kind: 'confirmation' });
    expect(seen.body).toMatchObject({ token: 'invite-1' });
  });

  it('refuses an instance a list build does not offer, sending nothing', async () => {
    const env = envOf(configOf({ mode: 'list', origins: [ORIGIN] }));

    const outcome = await submitRegistration({ ...VALUES, instance: 'other.example' }, env);

    expect(outcome).toStrictEqual({
      kind: 'error',
      message: 'That instance is not available here',
      fields: {},
    });
    expect(env.dispatch).not.toHaveBeenCalled();
  });

  it('adopts an account that comes signed in', async () => {
    mockRegistration();
    const env = envOf(configOf({ mode: 'same-origin' }));

    const outcome = await submitRegistration(VALUES, env);

    expect(outcome.kind).toBe('ok');
    expect(env.accounts.list().map((account) => account.handle)).toStrictEqual([
      'lain@wired.example',
    ]);
    expect(env.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'accounts', activeKey: `${ORIGIN}#109` }),
    );
  });
});
