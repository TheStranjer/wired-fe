/**
 * Tests for `/account logout`: the revoke sent to the instance (MSW), the
 * account gone from the store, the fresh list dispatched, the account's
 * windows closed and nobody else's, a failed revoke or a failed app
 * registration only ever a warning on the way out, and the refusals.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './account';
import {
  BOB,
  LAIN,
  ORIGIN,
  homeWindowId,
  keyOf,
  serveRevoke,
  serveRevokeRefused,
  signedIn,
} from '../../test/accountWindows';
import { fakeCommandContext } from '../../test/commandContext';
import { server } from '../../test/server';

describe('/account logout', () => {
  it('revokes the active account token and forgets the account', async () => {
    const bodies = serveRevoke();
    const context = signedIn([LAIN, BOB]);

    const outcome = await command.run('logout', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(bodies).toStrictEqual([
      { client_id: 'cid', client_secret: 'csecret', token: `token-${LAIN}` },
    ]);
    expect(context.stores.accounts.list().map((account) => account.handle)).toStrictEqual([BOB]);
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'accounts',
      accounts: context.stores.accounts.list(),
      activeKey: keyOf(2),
    });
    expect(context.print).toHaveBeenCalledWith('Logged out @lain@wired.example');
  });

  it('closes the windows of the logged-out account and no others', async () => {
    serveRevoke();
    const context = signedIn([LAIN, BOB]);

    await command.run('logout', context);

    expect(context.dispatchWindows).toHaveBeenCalledWith({ type: 'close', id: homeWindowId(1) });
    expect(context.dispatchWindows).not.toHaveBeenCalledWith({
      type: 'close',
      id: homeWindowId(2),
    });
  });

  it('logs out the account the query names, leaving the other signed in', async () => {
    serveRevoke();
    const context = signedIn([LAIN, BOB]);

    const outcome = await command.run('logout bob', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.stores.accounts.list().map((account) => account.handle)).toStrictEqual([LAIN]);
    expect(context.stores.accounts.activeKey()).toBe(keyOf(1));
    expect(context.dispatchWindows).toHaveBeenCalledWith({ type: 'close', id: homeWindowId(2) });
    expect(context.print).toHaveBeenCalledWith('Logged out @bob@wired.example');
  });

  it('drops the logged-out account from the sync list and keeps the others in order', async () => {
    serveRevoke();
    const context = signedIn([LAIN, BOB]);
    context.stores.sync.write({ syncAccounts: [keyOf(1), keyOf(2)], syncEnabled: true });

    await command.run('logout', context);

    expect(context.stores.sync.read()).toStrictEqual({
      syncAccounts: [keyOf(2)],
      syncEnabled: true,
    });
  });

  it('logs out anyway and warns when the instance refuses the revoke', async () => {
    serveRevokeRefused();
    const context = signedIn([LAIN]);

    const outcome = await command.run('logout', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith(
      'Could not revoke the token: HTTP 500: nope',
      'warn',
    );
    expect(context.stores.accounts.list()).toStrictEqual([]);
    expect(context.print).toHaveBeenCalledWith('Logged out @lain@wired.example');
  });

  it('warns and still forgets the account when no app can be registered', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/apps`, () => {
        return HttpResponse.json({ error: 'boom' }, { status: 503 });
      }),
    );
    const context = signedIn([LAIN], false);

    const outcome = await command.run('logout', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith(
      'Could not revoke the token: HTTP 503: boom',
      'warn',
    );
    expect(context.stores.accounts.list()).toStrictEqual([]);
  });

  it('refuses to log out a query nothing matched and an empty list', async () => {
    const context = signedIn([LAIN]);

    await expect(command.run('logout 9', context)).resolves.toStrictEqual({
      ok: false,
      message: `You aren't signed in as 9. Signed in: @${LAIN}. Type /connect to add an account.`,
    });
    await expect(command.run('logout', fakeCommandContext())).resolves.toStrictEqual({
      ok: false,
      message: 'Not logged in. Type /connect',
    });

    expect(context.stores.accounts.list()).toHaveLength(1);
  });
});
