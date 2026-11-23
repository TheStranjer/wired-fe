/**
 * Tests for the field errors of a failed response: Mastodon's `details`
 * object (a list of `{ error, description }` per field) and plain string lists
 * arrive on the `http` error as messages per field; a body without usable
 * details, or with empty ones, leaves the error without a `details` key.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import type { ApiError } from './errors';
import { toApiResponse } from './response';

/** The error of a failed response with {@link status} and {@link body}. */
async function errorOf(status: number, body: unknown): Promise<ApiError | null> {
  const result = await toApiResponse(new Response(JSON.stringify(body), { status }), v.any());
  return result.ok ? null : result.error;
}

describe('the details of an http error', () => {
  it('keeps the description of each of a field error', async () => {
    const error = await errorOf(422, {
      error: 'Validation failed',
      details: {
        email: [{ error: 'ERR_TAKEN', description: 'has already been taken' }],
        password: [{ error: 'ERR_BLANK', description: "can't be blank" }, 'is too short'],
      },
    });

    expect(error).toStrictEqual({
      kind: 'http',
      status: 422,
      message: 'Validation failed',
      details: { email: ['has already been taken'], password: ["can't be blank", 'is too short'] },
    });
  });

  it.each([
    ['no details', { error: 'Nope' }],
    ['empty details', { error: 'Nope', details: {} }],
    ['details that are not an object of lists', { error: 'Nope', details: 'bad' }],
    ['a list item that is no message', { error: 'Nope', details: { a: [3] } }],
  ])('leaves the error bare for %s', async (_name, body) => {
    const error = await errorOf(422, body);

    expect(error).toStrictEqual({ kind: 'http', status: 422, message: 'Nope' });
  });

  it('leaves the error bare for a body that is not an object', async () => {
    const error = await errorOf(500, 'oops');

    expect(error).toStrictEqual({ kind: 'http', status: 500, message: 'Request failed' });
  });
});
