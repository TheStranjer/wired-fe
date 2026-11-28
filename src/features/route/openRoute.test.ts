/**
 * Tests for opening an account route by name: a handle the instance has not
 * stored is found through the resolving search for a signed-in session, and
 * a signed-out session never searches (WFE-341).
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { openRoute } from './openRoute';
import type { ApiSession } from '../../api/session';
import { anonKey } from '../../state/anonAccount';
import { FOREIGN_WIRE, ORIGIN } from '../../test/homeWindow';
import { server } from '../../test/server';

/** Serves a 404 lookup and a search finding bob; the searches made are counted. */
function serveBob(): { searches: number } {
  const seen = { searches: 0 };
  server.use(
    http.get(`${ORIGIN}/api/v1/accounts/lookup`, () => {
      return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
    }),
    http.get(`${ORIGIN}/api/v2/search`, () => {
      seen.searches += 1;
      return HttpResponse.json({ accounts: [{ ...FOREIGN_WIRE, acct: 'bob@remote.example' }] });
    }),
  );
  return seen;
}

describe('openRoute for an account name', () => {
  it('opens the profile found by search for a signed-in account', async () => {
    const seen = serveBob();
    const dispatch = vi.fn();
    const session: ApiSession = { origin: ORIGIN, token: 'token' };

    await openRoute(
      { kind: 'acct', value: '@bob@remote.example' },
      { accountKey: 'k', session, dispatch },
    );

    expect(seen.searches).toBe(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'windows',
      action: {
        type: 'open',
        ref: { kind: 'profile', accountKey: 'k', target: '2' },
        title: '@bob@remote.example',
      },
    });
  });

  it('prints the lookup error and does not search for a signed-out window', async () => {
    const seen = serveBob();
    const dispatch = vi.fn();
    const session: ApiSession = { origin: ORIGIN, token: null };

    await openRoute(
      { kind: 'acct', value: '@bob@remote.example' },
      { accountKey: anonKey(ORIGIN), session, dispatch },
    );

    expect(seen.searches).toBe(0);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'print', level: 'error' }),
    );
  });
});
