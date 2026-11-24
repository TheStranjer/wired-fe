/**
 * Tests for the external-login endpoints over the shared MSW server: every
 * request is anonymous and asks for JSON, the state and tokens travel as the
 * wired-be contract says, the answers are told apart (redirect or pending,
 * missing details read as empty), and refusals arrive as the shared http errors.
 */
import { describe, expect, it } from 'vitest';

import {
  getExternalConsent,
  getRegistrationDetails,
  postExternalConsent,
  postExternalRegister,
} from './external';
import { CONSENT, DETAILS, ORIGIN, mockExternal } from '../../test/externalServer';

const SESSION = { origin: ORIGIN, token: null };

describe(getRegistrationDetails, () => {
  it('sends the state anonymously and maps the answer', async () => {
    const seen = mockExternal();

    const result = await getRegistrationDetails(SESSION, 'st-1');

    expect(result).toStrictEqual({ ok: true, value: DETAILS });
    expect(seen.query?.get('state')).toBe('st-1');
    expect(seen.accept).toBe('application/json');
    expect(seen.auth).toBeNull();
  });

  it('reads missing and null parts as empty', async () => {
    mockExternal({ details: { body: { nickname: 'lain', email: null } } });

    await expect(getRegistrationDetails(SESSION, 'st-1')).resolves.toStrictEqual({
      ok: true,
      value: { nickname: 'lain', email: '', name: '', provider: '' },
    });
  });

  it('returns the http error of a bad state', async () => {
    mockExternal({ details: { status: 404, body: { error: 'Unknown state' } } });

    await expect(getRegistrationDetails(SESSION, 'nope')).resolves.toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 404, message: 'Unknown state' },
    });
  });
});

describe(postExternalRegister, () => {
  const BODY = { state: 'st-1', nickname: 'lain', email: 'lain@example.com' };

  it('posts the body and reads a redirect', async () => {
    const seen = mockExternal();

    const result = await postExternalRegister(SESSION, { ...BODY, password: 'pw' });

    expect(result).toStrictEqual({
      ok: true,
      value: { kind: 'redirect', uri: 'https://cool.example/cb?code=abc' },
    });
    expect(seen.registered).toStrictEqual({ ...BODY, password: 'pw' });
  });

  it.each(['approval', 'confirmation'] as const)('reads a pending %s', async (reason) => {
    mockExternal({ register: { body: { pending: reason } } });

    await expect(postExternalRegister(SESSION, BODY)).resolves.toStrictEqual({
      ok: true,
      value: { kind: 'pending', reason },
    });
  });

  it('returns the 422 error', async () => {
    mockExternal({ register: { status: 422, body: { error: 'Nickname has been taken' } } });

    await expect(postExternalRegister(SESSION, BODY)).resolves.toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 422, message: 'Nickname has been taken' },
    });
  });

  it('reports an unknown pending step as a parse error', async () => {
    mockExternal({ register: { body: { pending: 'later' } } });

    await expect(postExternalRegister(SESSION, BODY)).resolves.toMatchObject({
      ok: false,
      error: { kind: 'parse' },
    });
  });
});

describe(getExternalConsent, () => {
  it('sends the state and confirm token and maps the answer', async () => {
    const seen = mockExternal();

    const result = await getExternalConsent(SESSION, 'st-1', 'ct-1');

    expect(result).toStrictEqual({ ok: true, value: CONSENT });
    expect(seen.query?.get('state')).toBe('st-1');
    expect(seen.query?.get('confirm_token')).toBe('ct-1');
  });

  it('allows an app with no website', async () => {
    mockExternal({ consent: { body: { app: { name: 'Bare' }, scopes: [] } } });

    await expect(getExternalConsent(SESSION, 's', 't')).resolves.toStrictEqual({
      ok: true,
      value: { app: { name: 'Bare', website: null }, scopes: [] },
    });
  });
});

describe(postExternalConsent, () => {
  it('posts the answer and reads the address', async () => {
    const seen = mockExternal();

    const result = await postExternalConsent(SESSION, {
      state: 'st-1',
      confirm_token: 'ct-1',
      approve: false,
    });

    expect(result).toStrictEqual({ ok: true, value: 'https://cool.example/cb?code=abc' });
    expect(seen.decided).toStrictEqual({ state: 'st-1', confirm_token: 'ct-1', approve: false });
  });
});
