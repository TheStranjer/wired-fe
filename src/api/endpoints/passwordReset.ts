/**
 * Password reset: the request half (`POST /auth/password`, which names the
 * account by e-mail address or nickname and always answers 204, so nothing
 * leaks about which accounts exist) and the completion half
 * (`POST /api/v1/pleroma/password_reset`, the token of the reset letter plus
 * the new password). Neither needs a login. Until wired-be answers the
 * completion with JSON instead of its HTML page, any 2xx counts as success
 * whatever its body is; a refusal arrives as the `http` error carrying the
 * server's `error` string.
 */
import { type Result, ok } from '../../lib/result';
import type { ApiError } from '../errors';
import { requestData } from '../http';
import { NothingSchema } from '../response';

/** Which account a reset letter is for: its e-mail address or its nickname. */
export type ResetTarget = { readonly email: string } | { readonly nickname: string };

/** What the reset letter's link and the form give to finish a reset. */
export type ResetCompletion = {
  /** The token in the letter's link. */
  readonly token: string;
  readonly password: string;
  readonly passwordConfirmation: string;
};

/**
 * Posts {@link json} to {@link path} without a token. A 2xx whose body is not
 * JSON (the HTML page wired-be still answers with) is a success too: the body
 * schema accepts anything, so a `parse` error can only come from such a body.
 */
async function post(
  origin: string,
  path: string,
  json: Record<string, string>,
): Promise<Result<null, ApiError>> {
  const result = await requestData({ origin, path, method: 'POST', json, schema: NothingSchema });
  return !result.ok && result.error.kind === 'parse' ? ok(null) : result;
}

/** Asks the instance at {@link origin} to mail a reset letter to {@link target}'s account. */
export async function requestPasswordReset(
  origin: string,
  target: ResetTarget,
): Promise<Result<null, ApiError>> {
  return post(origin, '/auth/password', { ...target });
}

/** Sets the new password for the reset token in {@link completion} on the instance at {@link origin}. */
export async function completePasswordReset(
  origin: string,
  completion: ResetCompletion,
): Promise<Result<null, ApiError>> {
  return post(origin, '/api/v1/pleroma/password_reset', {
    token: completion.token,
    password: completion.password,
    password_confirmation: completion.passwordConfirmation,
  });
}
