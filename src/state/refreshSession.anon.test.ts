/**
 * Tests for the signed-out path of the token-refresh seam (WFE-340): a call
 * under an `anon:<origin>` key runs tokenless, never sends an `Authorization`
 * header, never refreshes and never signs anyone out; a 401 or a 403 is
 * reported with `anonRefused` and the answer comes back unchanged.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { anonKey } from './anonAccount';
import { withFreshToken } from './refreshSession';
import { err, ok } from '../lib/result';
import { status } from '../test/fixtures';
import { ORIGIN, readStatus, serveRefresh, setup } from '../test/refreshHarness';
import { server } from '../test/server';

const KEY = anonKey(ORIGIN);

/** Serve the status with {@link answer}, recording the Authorization header of each request. */
function serveRecording(answer: () => Response): (string | null)[] {
  const seen: (string | null)[] = [];
  server.use(
    http.get(`${ORIGIN}/api/v1/statuses/1`, ({ request }) => {
      seen.push(request.headers.get('Authorization'));
      return answer();
    }),
  );
  return seen;
}

describe('withFreshToken signed out', () => {
  it('reads with no token and sends no Authorization header', async () => {
    const { deps, actions } = setup();
    const seen = serveRecording(() => HttpResponse.json(status('1')));

    const result = await withFreshToken(deps, KEY, readStatus);

    expect(result).toStrictEqual(ok(status('1')));
    expect(seen).toStrictEqual([null]);
    expect(actions).toStrictEqual([]);
  });

  it.each([401, 403])(
    'reports a %i as a refusal, once, with no refresh and no sign-out',
    async (code) => {
      const { deps, actions } = setup();
      const refresh = serveRefresh(() => HttpResponse.json({}, { status: 500 }));
      const seen = serveRecording(() => HttpResponse.json({ error: 'nope' }, { status: code }));

      const result = await withFreshToken(deps, KEY, readStatus);

      expect(result).toStrictEqual(err({ kind: 'http', status: code, message: 'nope' }));
      expect(seen).toStrictEqual([null]);
      expect(refresh.requests()).toBe(0);
      expect(actions).toStrictEqual([{ type: 'anonRefused', accountKey: KEY }]);
    },
  );

  it('reports nothing for any other failure', async () => {
    const { deps, actions } = setup();
    serveRecording(() => HttpResponse.json({ error: 'gone' }, { status: 404 }));

    const result = await withFreshToken(deps, KEY, readStatus);

    expect(result.ok).toBe(false);
    expect(actions).toStrictEqual([]);
  });
});
