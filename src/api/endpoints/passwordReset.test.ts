/**
 * Tests for the password-reset calls over the shared MSW server: the reset
 * request's JSON body for an e-mail address and for a nickname, the
 * completion's body, success on any 2xx (an empty 204, a JSON body and the
 * HTML page wired-be still answers with included), and the server's error
 * string on a 4xx.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { completePasswordReset, requestPasswordReset } from './passwordReset';
import { server } from '../../test/server';

const ORIGIN = 'https://wired.example';

/** What the next request to {@link path} carried: its auth header and JSON body. */
type Seen = { auth: string | null; body: unknown };

/** Answers `POST <origin><path>` with {@link respond}, recording the request into the returned object. */
function answer(path: string, respond: () => Response): Seen {
  const seen: Seen = { auth: null, body: null };
  server.use(
    http.post(`${ORIGIN}${path}`, async ({ request }) => {
      seen.auth = request.headers.get('Authorization');
      seen.body = await request.json();
      return respond();
    }),
  );
  return seen;
}

const COMPLETION = { token: 'tok-1', password: 'new secret', passwordConfirmation: 'new secret' };

describe(requestPasswordReset, () => {
  it('posts the e-mail address without a token', async () => {
    const seen = answer('/auth/password', () => new HttpResponse(null, { status: 204 }));

    const result = await requestPasswordReset(ORIGIN, { email: 'lain@example.com' });

    expect(seen.body).toStrictEqual({ email: 'lain@example.com' });
    expect(seen.auth).toBeNull();
    expect(result).toStrictEqual({ ok: true, value: null });
  });

  it('posts the nickname', async () => {
    const seen = answer('/auth/password', () => new HttpResponse(null, { status: 204 }));

    const result = await requestPasswordReset(ORIGIN, { nickname: 'lain' });

    expect(seen.body).toStrictEqual({ nickname: 'lain' });
    expect(result).toStrictEqual({ ok: true, value: null });
  });

  it('returns the error of a refusal', async () => {
    answer('/auth/password', () => HttpResponse.json({ error: 'Nope' }, { status: 400 }));

    const result = await requestPasswordReset(ORIGIN, { nickname: 'lain' });

    expect(result).toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 400, message: 'Nope' },
    });
  });
});

describe(completePasswordReset, () => {
  it('posts the token, the password and its confirmation', async () => {
    const seen = answer(
      '/api/v1/pleroma/password_reset',
      () => new HttpResponse(null, { status: 204 }),
    );

    const result = await completePasswordReset(ORIGIN, COMPLETION);

    expect(seen.body).toStrictEqual({
      token: 'tok-1',
      password: 'new secret',
      password_confirmation: 'new secret',
    });
    expect(seen.auth).toBeNull();
    expect(result).toStrictEqual({ ok: true, value: null });
  });

  it('counts a JSON 2xx as success', async () => {
    answer('/api/v1/pleroma/password_reset', () => HttpResponse.json({ status: 'success' }));

    const result = await completePasswordReset(ORIGIN, COMPLETION);

    expect(result).toStrictEqual({ ok: true, value: null });
  });

  it('counts an HTML 2xx as success', async () => {
    answer('/api/v1/pleroma/password_reset', () => HttpResponse.html('<p>Password changed</p>'));

    const result = await completePasswordReset(ORIGIN, COMPLETION);

    expect(result).toStrictEqual({ ok: true, value: null });
  });

  it('returns the server’s error string on a 4xx', async () => {
    answer('/api/v1/pleroma/password_reset', () =>
      HttpResponse.json({ error: 'Invalid token' }, { status: 400 }),
    );

    const result = await completePasswordReset(ORIGIN, COMPLETION);

    expect(result).toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 400, message: 'Invalid token' },
    });
  });

  it('returns a network failure', async () => {
    server.use(http.post(`${ORIGIN}/api/v1/pleroma/password_reset`, () => HttpResponse.error()));

    const result = await completePasswordReset(ORIGIN, COMPLETION);

    expect(result).toMatchObject({ ok: false, error: { kind: 'network' } });
  });
});
