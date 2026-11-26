/**
 * Tests for `/sync`: the report (primary, fallbacks, the account in use and
 * why others are skipped), `primary`, `on` and `off`, and the arguments that
 * match no form. The `fallback` forms are in sync.fallback.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './sync';
import {
  K_BOB,
  K_EVE,
  K_LAIN,
  NOT_SIGNED_IN_AS_NOBODY,
  desk,
  listed,
  printed,
  refused,
} from '../../test/syncDesk';

describe('/sync report', () => {
  it('names the first usable account when nothing is chosen', async () => {
    const context = desk();

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(printed(context)).toStrictEqual([
      'Sync: on',
      'Primary: none chosen (the first usable account is used)',
      'In use: @lain@lain.example',
    ]);
  });

  it('lists the primary and fallbacks and says which is skipped and why', async () => {
    const context = listed([K_BOB, K_EVE, K_LAIN], [K_EVE]);

    await command.run('', context);

    expect(printed(context)).toStrictEqual([
      'Sync: on',
      'Primary: @bob@bob.example (skipped: no settings store)',
      'Fallback 1: @eve@eve.example (skipped: session expired)',
      'Fallback 2: @lain@lain.example',
      'In use: @lain@lain.example',
    ]);
  });

  it('names a listed account that is no longer signed in by its key', async () => {
    const context = listed(['https://gone.example#9', K_EVE]);

    await command.run('', context);

    expect(printed(context)).toContain('Primary: https://gone.example#9 (skipped: not signed in)');
    expect(printed(context)).toContain('In use: @eve@eve.example');
  });

  it('says nothing is in use when no listed account can hold the desk', async () => {
    const context = listed([K_BOB]);

    await command.run('', context);

    expect(printed(context).at(-1)).toBe('In use: none');
  });

  it('says sync is off', async () => {
    const context = desk();
    context.stores.sync.write({ syncAccounts: [], syncEnabled: false });

    await command.run('', context);

    expect(printed(context)).toStrictEqual(['Sync: off. Type /sync on to switch it back on']);
  });
});

describe('/sync primary', () => {
  it('makes the named account the primary and keeps the others behind it', async () => {
    const context = listed([K_LAIN, K_EVE]);

    const outcome = await command.run('primary @eve@eve.example', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.stores.sync.read()).toStrictEqual({
      syncAccounts: [K_EVE, K_LAIN],
      syncEnabled: true,
    });
    expect(context.print).toHaveBeenCalledWith(
      'Sync accounts: @eve@eve.example, @lain@lain.example',
    );
  });

  it('switches sync back on and starts a list when there was none', async () => {
    const context = desk();
    context.stores.sync.write({ syncAccounts: [], syncEnabled: false });

    await command.run('primary bob', context);

    expect(context.stores.sync.read()).toStrictEqual({ syncAccounts: [K_BOB], syncEnabled: true });
  });

  it('refuses an account nobody is signed in as and stores nothing', async () => {
    const context = desk();

    await expect(command.run('primary @nobody@nowhere.example', context)).resolves.toStrictEqual(
      refused(NOT_SIGNED_IN_AS_NOBODY),
    );

    expect(context.stores.sync.read().syncAccounts).toStrictEqual([]);
  });
});

describe('/sync off and on', () => {
  it('empties the list and turns sync off', async () => {
    const context = listed([K_LAIN, K_EVE]);

    await expect(command.run('off', context)).resolves.toStrictEqual({ ok: true });

    expect(context.stores.sync.read()).toStrictEqual({ syncAccounts: [], syncEnabled: false });
    expect(context.print).toHaveBeenCalledWith('Sync: off');
  });

  it('turns sync back on', async () => {
    const context = desk();
    context.stores.sync.write({ syncAccounts: [], syncEnabled: false });

    await expect(command.run('on', context)).resolves.toStrictEqual({ ok: true });

    expect(context.stores.sync.read()).toStrictEqual({ syncAccounts: [], syncEnabled: true });
    expect(context.print).toHaveBeenCalledWith('Sync: on');
  });

  it('keeps the list when turned on while it holds accounts', async () => {
    const context = listed([K_EVE]);

    await command.run('on', context);

    expect(context.stores.sync.read().syncAccounts).toStrictEqual([K_EVE]);
  });
});

describe('/sync usage', () => {
  it.each([
    'bogus',
    'primary',
    'primary lain eve',
    'fallback',
    'fallback bogus lain',
    'fallback add',
    'fallback add lain eve',
    'on now',
    'off now',
  ])('echoes the usage for %s', async (args) => {
    const outcome = await command.run(args, desk());

    expect(outcome).toStrictEqual(refused(`Usage: ${command.usage}`));
  });
});
