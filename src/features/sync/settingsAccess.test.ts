/**
 * Tests for the desk sync's two calls over the shared MSW server: the read
 * and the write go to the account's own server with the account's own token,
 * and the server's typed refusals come back as they are.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { readSettings, writeSettings } from './settingsAccess';
import type { StoredAccount } from '../../accounts/accountStore';
import { ok } from '../../lib/result';
import { server } from '../../test/server';

const ORIGIN = 'https://wired.example';

const URL = `${ORIGIN}/api/v1/pleroma/settings/wired-fe`;

const ACCOUNT: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'secret',
  refreshToken: null,
  expiresAt: null,
};

describe('desk sync settings access', () => {
  it("reads the account's object with the account's token", async () => {
    const seen: Request[] = [];
    server.use(
      http.get(URL, ({ request }) => {
        seen.push(request.clone());
        return HttpResponse.json({ version: 1 });
      }),
    );

    await expect(readSettings(ACCOUNT)).resolves.toStrictEqual(ok({ version: 1 }));
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer secret');
  });

  it('writes the patch as a JSON body and answers the merged object', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch(URL, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json({ desktop: { updatedAt: 5 } });
      }),
    );

    await expect(writeSettings(ACCOUNT, { desktop: { updatedAt: 5 } })).resolves.toStrictEqual(
      ok({ desktop: { updatedAt: 5 } }),
    );
    expect(bodies).toStrictEqual([{ desktop: { updatedAt: 5 } }]);
  });

  it('answers a refusal as the typed error', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ error: 'no' }, { status: 403 })));

    await expect(readSettings(ACCOUNT)).resolves.toStrictEqual({
      ok: false,
      error: { kind: 'forbidden' },
    });
  });
});
