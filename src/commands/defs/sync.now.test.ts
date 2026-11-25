/**
 * Tests for the sync side of `/sync` (decision 17): `now` asks the engine for
 * a pull and a push when an account can hold the desk and refuses when none
 * can, every change of the choices has the engine pull, and the report adds
 * the last pull, the last push and the last error once there are any.
 */
import { describe, expect, it } from 'vitest';

import { command } from './sync';
import { formatClock } from '../../lib/time';
import { appReducer } from '../../state/reducer';
import { K_EVE, K_LAIN, desk, listed, printed, refused } from '../../test/syncDesk';

describe('/sync now', () => {
  it('asks for a pull and a push and says so', async () => {
    const context = desk();

    await expect(command.run('now', context)).resolves.toStrictEqual({ ok: true });

    expect(context.requestSync).toHaveBeenCalledExactlyOnceWith('now');
    expect(printed(context)).toStrictEqual(['Syncing…']);
  });

  it('refuses when no account can hold the desk', async () => {
    const context = desk();
    context.stores.sync.write({ syncAccounts: [], syncEnabled: false });

    await expect(command.run('now', context)).resolves.toStrictEqual(
      refused('No account can hold the synced desk. Type /sync to see why'),
    );

    expect(context.requestSync).not.toHaveBeenCalled();
  });
});

describe('/sync choices', () => {
  it.each([
    ['primary @eve@eve.example', [K_LAIN]],
    ['fallback add @eve@eve.example', [K_LAIN]],
    ['fallback rm @eve@eve.example', [K_LAIN, K_EVE]],
    ['fallback up @eve@eve.example', [K_LAIN, K_EVE]],
    ['off', [K_LAIN]],
    ['on', [K_LAIN]],
  ])('has the engine pull after %s', async (args, keys) => {
    const context = listed(keys);

    await command.run(args, context);

    expect(context.requestSync).toHaveBeenCalledExactlyOnceWith('pull');
  });

  it('has the engine pull nothing when the choice is refused', async () => {
    const context = listed([K_LAIN]);

    await command.run('primary @nobody@nowhere.example', context);

    expect(context.requestSync).not.toHaveBeenCalled();
  });
});

describe('/sync history', () => {
  it('adds the last pull, the last push and the last error once there are any', async () => {
    const base = desk();
    const at = (hour: number, minute: number): number =>
      new Date(2026, 10, 25, hour, minute).getTime();
    const state = appReducer(base.state, {
      type: 'sync',
      status: { lastPull: at(9, 5), lastPush: at(9, 6), lastError: 'Sync failed. HTTP 500: Boom' },
    });

    await command.run('', { ...base, state });

    expect(printed({ ...base, state }).slice(-3)).toStrictEqual([
      `Last pull: ${formatClock(new Date(at(9, 5)), '24h')}`,
      `Last push: ${formatClock(new Date(at(9, 6)), '24h')}`,
      'Last error: Sync failed. HTTP 500: Boom',
    ]);
  });

  it('adds nothing before the sync has done anything', async () => {
    const context = desk();

    await command.run('', context);

    expect(printed(context)).toHaveLength(3);
  });

  it('shows only what happened', async () => {
    const base = desk();
    const state = appReducer(base.state, { type: 'sync', status: { lastPush: 0 } });
    const context = { ...base, state };

    await command.run('', context);

    expect(printed(context).filter((line) => line.startsWith('Last '))).toHaveLength(1);
  });
});
