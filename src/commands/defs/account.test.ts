/**
 * Tests for /account: the definition the registry, /help, completion and the
 * keymap read, the numbered list with its `>` marker, switching by index,
 * handle and unique prefix, `next` stepping forward and wrapping, and the
 * refusals every form answers with. The logout half is ./account.logout.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './account';
import { BOB, LAIN, keyOf, signedIn } from '../../test/accountWindows';
import { fakeCommandContext } from '../../test/commandContext';

describe('/account', () => {
  it('declares its name, alias, grammar, summary and hotkeys', () => {
    expect(command.name).toBe('account');
    expect(command.aliases).toStrictEqual(['acc']);
    expect(command.usage).toBe(
      '/account [list] | /account switch <n|handle> | /account next | /account logout [n|handle]',
    );
    expect(command.summary).toBe('List, switch between and log out of accounts');
    expect(command.bindings).toStrictEqual([
      { mode: 'insert', chord: 'Alt+a', args: 'next' },
      { mode: 'navigation', chord: 'a', args: 'next' },
    ]);
  });

  it('lists the accounts numbered, > marking the active one', async () => {
    const context = signedIn([LAIN, BOB]);

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith('> 1: @lain@wired.example');
    expect(context.print).toHaveBeenCalledWith('  2: @bob@wired.example');
  });

  it('lists the same way under list and marks the switched-to account', async () => {
    const context = signedIn([LAIN, BOB]);
    context.stores.accounts.setActive(keyOf(2));

    await command.run('list', context);

    expect(context.print).toHaveBeenCalledWith('  1: @lain@wired.example');
    expect(context.print).toHaveBeenCalledWith('> 2: @bob@wired.example');
  });

  it('refuses to list when nobody is signed in', async () => {
    const context = fakeCommandContext();

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('switches by 1-based index and reports the new active account', async () => {
    const context = signedIn([LAIN, BOB]);

    const outcome = await command.run('switch 2', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.stores.accounts.activeKey()).toBe(keyOf(2));
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'accounts',
      accounts: context.stores.accounts.list(),
      activeKey: keyOf(2),
    });
    expect(context.print).toHaveBeenCalledWith('Active account: @bob@wired.example');
  });

  it('switches by full handle and by unique username prefix', async () => {
    const byHandle = signedIn([LAIN, BOB]);
    const byPrefix = signedIn([LAIN, BOB]);

    await command.run('switch @bob@wired.example', byHandle);
    await command.run('switch la', byPrefix);

    expect(byHandle.stores.accounts.activeKey()).toBe(keyOf(2));
    expect(byPrefix.stores.accounts.activeKey()).toBe(keyOf(1));
  });

  it('refuses a switch to a query nothing matched and keeps the active one', async () => {
    const context = signedIn([LAIN, BOB]);

    const outcome = await command.run('switch nobody', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: `You aren't signed in as nobody. Signed in: @${LAIN}, @${BOB}. Type /connect to add an account.`,
    });
    expect(context.stores.accounts.activeKey()).toBe(keyOf(1));
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('echoes the usage when switch names no account at all', async () => {
    const context = signedIn([LAIN]);

    const outcome = await command.run('switch', context);

    expect(outcome).toStrictEqual({ ok: false, message: `Usage: ${command.usage}` });
    expect(context.stores.accounts.activeKey()).toBe(keyOf(1));
  });

  it('steps to the next account and wraps at the end', async () => {
    const context = signedIn([LAIN, BOB]);

    await command.run('next', context);

    expect(context.stores.accounts.activeKey()).toBe(keyOf(2));

    await command.run('next', context);

    expect(context.stores.accounts.activeKey()).toBe(keyOf(1));
    expect(context.print).toHaveBeenLastCalledWith('Active account: @lain@wired.example');
  });

  it('has nothing to step to when nobody is signed in', async () => {
    const outcome = await command.run('next', fakeCommandContext());

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
  });

  it('refuses an argument that is none of its forms', async () => {
    const context = signedIn([LAIN]);

    const outcome = await command.run('sideways', context);

    expect(outcome).toStrictEqual({ ok: false, message: `Usage: ${command.usage}` });
  });
});
