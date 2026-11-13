/**
 * The instance document endpoints (decision 5): `GET /api/v1/instance` and
 * `GET /api/v2/instance` answer the descriptions of an instance the capability
 * builder reads. The shared schemas normalize Wired, Mastodon and Pleroma
 * shapes onto one model (decision 7). Not every server has a v2 document:
 * {@link getInstanceV2} reports its absence — the 404 — as a successful null.
 */
import { type Result, ok } from '../../lib/result';
import type { ApiError } from '../errors';
import { type InstanceV1, InstanceV1Schema } from '../schemas/instanceV1';
import { type InstanceV2, InstanceV2Schema } from '../schemas/instanceV2';
import { type ApiSession, sessionRequestData } from '../session';

/**
 * Fetches {@link session}'s instance's v1 document and returns its summary.
 * {@link signal} can cancel the request, which answers the `aborted` error.
 */
export async function getInstanceV1(
  session: ApiSession,
  signal?: AbortSignal,
): Promise<Result<InstanceV1, ApiError>> {
  return sessionRequestData(session, {
    path: '/api/v1/instance',
    schema: InstanceV1Schema,
    ...(signal === undefined ? {} : { signal }),
  });
}

/**
 * Fetches the v2 document and returns its summary, or `ok(null)` when the
 * server has no v2 document (404). Every other failure propagates unchanged;
 * {@link signal} can cancel the request.
 */
export async function getInstanceV2(
  session: ApiSession,
  signal?: AbortSignal,
): Promise<Result<InstanceV2 | null, ApiError>> {
  const result = await sessionRequestData(session, {
    path: '/api/v2/instance',
    schema: InstanceV2Schema,
    ...(signal === undefined ? {} : { signal }),
  });
  if (!result.ok && result.error.kind === 'http' && result.error.status === 404) {
    return ok(null);
  }
  return result;
}
