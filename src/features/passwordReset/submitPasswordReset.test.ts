/**
 * Tests for sending the new-password form over MSW: an empty password and a
 * mismatch are refused before any request, the instance comes from the build's
 * mode, the request carries the token and both passwords, a refusal says the
 * server's error string, and other failures are described.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { type PasswordResetEnv, submitPasswordReset } from './submitPasswordReset';
import { server } from '../../test/server';

const ORIGIN = 'https://wired.example';

const ENV: PasswordResetEnv = {
  token: 'tok-1',
  config: { appName: 'WiredFE', instances: { mode: 'same-origin' } },
  page: { origin: ORIGIN },
};

const VALUES = { instance: '', password: 'new secret', confirmation: 'new secret' };

/** Answers the reset endpoint with {@link respond}, recording every body into the returned list. */
function answer(respond: () => Response): unknown[] {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${ORIGIN}/api/v1/pleroma/password_reset`, async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    }),
  );
  return bodies;
}

describe(submitPasswordReset, () => {
  it('refuses an empty password without a request', async () => {
    const bodies = answer(() => new HttpResponse(null, { status: 204 }));

    const outcome = await submitPasswordReset({ ...VALUES, password: '', confirmation: '' }, ENV);

    expect(outcome).toStrictEqual({ kind: 'error', message: 'Enter a new password.' });
    expect(bodies).toHaveLength(0);
  });

  it('refuses a mismatch without a request', async () => {
    const bodies = answer(() => new HttpResponse(null, { status: 204 }));

    const outcome = await submitPasswordReset({ ...VALUES, confirmation: 'other' }, ENV);

    expect(outcome).toStrictEqual({ kind: 'error', message: 'The two passwords do not match.' });
    expect(bodies).toHaveLength(0);
  });

  it('sends the token and both passwords', async () => {
    const bodies = answer(() => new HttpResponse(null, { status: 204 }));

    const outcome = await submitPasswordReset(VALUES, ENV);

    expect(outcome).toStrictEqual({ kind: 'ok' });
    expect(bodies).toStrictEqual([
      { token: 'tok-1', password: 'new secret', password_confirmation: 'new secret' },
    ]);
  });

  it('refuses an instance the build does not allow', async () => {
    const config = { appName: 'WiredFE', instances: { mode: 'open' } } as const;

    const outcome = await submitPasswordReset(VALUES, { ...ENV, config });

    expect(outcome).toStrictEqual({
      kind: 'error',
      message: 'Enter an instance, like wired.example',
    });
  });

  it('says the server’s error string on a refusal', async () => {
    answer(() => HttpResponse.json({ error: 'Invalid token' }, { status: 400 }));

    const outcome = await submitPasswordReset(VALUES, ENV);

    expect(outcome).toStrictEqual({ kind: 'error', message: 'Invalid token' });
  });

  it('describes a failure that is no refusal', async () => {
    server.use(http.post(`${ORIGIN}/api/v1/pleroma/password_reset`, () => HttpResponse.error()));

    const outcome = await submitPasswordReset(VALUES, ENV);

    const message = outcome.kind === 'error' ? outcome.message : '';

    expect(message).toMatch(/^Network error/u);
  });
});
