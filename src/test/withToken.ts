/**
 * The {@link WithToken} stub the one-shot job tests share (AGENTS.md
 * "Testing"): every call runs with the one session, and a refused answer is
 * handed back as it is, since no refresh is attempted.
 */
import type { ApiSession } from '../api/session';
import type { WithToken } from '../state/refreshSession';

/** A {@link WithToken} that signs every call with {@link session}. */
export function withSession(session: ApiSession): WithToken {
  return async (call) => await call(session);
}
