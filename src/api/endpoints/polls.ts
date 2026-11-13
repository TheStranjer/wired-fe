/**
 * The poll vote endpoint: `POST /api/v1/polls/<id>/votes` casts this account's
 * ballot on a poll and answers the poll as its new voter now sees it — `voted`
 * true, the chosen option positions in `own_votes`, every counter already
 * moved. The body is the JSON object `{ choices }`, the options' zero-based
 * indexes; Wired and Mastodon both take it, and a single-choice poll refuses
 * more than one index. The shared {@link PollSchema} normalizes the answer
 * (decision 7). Refusals are plain failures: a poll that expired, was already
 * voted, or belongs to this account's own post comes back as its http error,
 * an unknown or invisible poll as a 404.
 */
import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Poll, PollSchema } from '../schemas/poll';
import { type ApiSession, sessionRequestData } from '../session';

/**
 * Votes on poll {@link pollId} of {@link session}'s instance for the option
 * indexes in {@link choices}: one POST to `/api/v1/polls/<id>/votes` with the
 * id percent-encoded into one path segment and the JSON body the servers
 * expect. The answer is the updated poll; any failure is the typed
 * {@link ApiError} `apiRequest` produced.
 */
export async function votePoll(
  session: ApiSession,
  pollId: string,
  choices: readonly number[],
): Promise<Result<Poll, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/polls/${encodeURIComponent(pollId)}/votes`,
    method: 'POST',
    json: { choices },
    schema: PollSchema,
  });
}
