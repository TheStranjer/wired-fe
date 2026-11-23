/**
 * Tests for account registration over the shared MSW server: the request's
 * method, bearer token and JSON body (the invite as `token`, the reason only
 * when given), the three kinds of answer and the 422 field errors.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { type NewAccount, createAccount } from './registration';
import { server } from '../../test/server';

const ORIGIN = 'https://wired.example';

const ACCOUNT: NewAccount = {
  username: 'lain',
  email: 'lain@example.com',
  password: 'correct horse',
  reason: '',
  locale: 'en',
  inviteToken: 'invite-1',
};

/** What the next registration request carried: its auth header and body. */
type Seen = { auth: string | null; body: unknown };

/** Answers the registration with {@link respond}, recording the request into the returned object. */
function answer(respond: () => Response): Seen {
  const seen: Seen = { auth: null, body: null };
  server.use(
    http.post(`${ORIGIN}/api/v1/accounts`, async ({ request }) => {
      seen.auth = request.headers.get('Authorization');
      seen.body = await request.json();
      return respond();
    }),
  );
  return seen;
}

describe(createAccount, () => {
  it('posts the form with the invite as token, under the app token', async () => {
    const seen = answer(() => HttpResponse.json({ access_token: 'user-token', scope: 'read' }));

    const result = await createAccount(ORIGIN, { appToken: 'app-token', account: ACCOUNT });

    expect(seen.auth).toBe('Bearer app-token');
    expect(seen.body).toStrictEqual({
      username: 'lain',
      email: 'lain@example.com',
      password: 'correct horse',
      agreement: true,
      locale: 'en',
      token: 'invite-1',
    });
    expect(result).toStrictEqual({
      ok: true,
      value: {
        token: {
          access_token: 'user-token',
          token_type: 'Bearer',
          scope: 'read',
          refresh_token: null,
          expires_in: null,
        },
        confirmationRequired: false,
        approvalRequired: false,
      },
    });
  });

  it('sends the reason when there is one', async () => {
    const seen = answer(() => HttpResponse.json({ access_token: 'user-token' }));

    await createAccount(ORIGIN, {
      appToken: 'app-token',
      account: { ...ACCOUNT, reason: 'I was invited' },
    });

    expect(seen.body).toMatchObject({ reason: 'I was invited' });
  });

  it('reads the flags of an answer without a token', async () => {
    answer(() => HttpResponse.json({ confirmation_required: true, approval_required: true }));

    const result = await createAccount(ORIGIN, { appToken: 'app-token', account: ACCOUNT });

    expect(result).toStrictEqual({
      ok: true,
      value: { token: null, confirmationRequired: true, approvalRequired: true },
    });
  });

  it('returns the 422 with its field errors', async () => {
    answer(() =>
      HttpResponse.json(
        {
          error: 'Validation failed: Username has already been taken',
          details: { username: [{ error: 'ERR_TAKEN', description: 'has already been taken' }] },
        },
        { status: 422 },
      ),
    );

    const result = await createAccount(ORIGIN, { appToken: 'app-token', account: ACCOUNT });

    expect(result).toStrictEqual({
      ok: false,
      error: {
        kind: 'http',
        status: 422,
        message: 'Validation failed: Username has already been taken',
        details: { username: ['has already been taken'] },
      },
    });
  });
});
