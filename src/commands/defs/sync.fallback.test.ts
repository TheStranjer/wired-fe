/**
 * Tests for `/sync fallback`: adding after the others, removing, moving an
 * account one place up, and the refusals — an unknown account, a list that
 * cannot take the edit.
 */
import { describe, expect, it } from 'vitest';

import { command } from './sync';
import { K_BOB, K_EVE, K_LAIN, desk, listed, refused } from '../../test/syncDesk';

describe('/sync fallback add', () => {
  it('adds an account after the others', async () => {
    const context = listed([K_LAIN]);

    await command.run('fallback add @eve@eve.example', context);

    expect(context.stores.sync.read().syncAccounts).toStrictEqual([K_LAIN, K_EVE]);
  });

  it('refuses to add before a primary is chosen', async () => {
    const context = desk();

    await expect(command.run('fallback add eve', context)).resolves.toStrictEqual(
      refused('No primary yet. Type /sync primary <handle> first'),
    );
  });

  it('refuses to add an account twice', async () => {
    const context = listed([K_LAIN, K_EVE]);

    await expect(command.run('fallback add eve', context)).resolves.toStrictEqual(
      refused('Already in the sync list'),
    );
  });

  it('refuses an account nobody is signed in as', async () => {
    const context = listed([K_LAIN]);

    await expect(
      command.run('fallback add @nobody@nowhere.example', context),
    ).resolves.toStrictEqual(refused('No account @nobody@nowhere.example'));
  });
});

describe('/sync fallback rm', () => {
  it('removes an account from the list', async () => {
    const context = listed([K_LAIN, K_EVE, K_BOB]);

    await command.run('fallback rm eve', context);

    expect(context.stores.sync.read().syncAccounts).toStrictEqual([K_LAIN, K_BOB]);
  });

  it('refuses to remove an account that is not listed', async () => {
    const context = listed([K_LAIN]);

    await expect(command.run('fallback rm eve', context)).resolves.toStrictEqual(
      refused('Not in the sync list'),
    );
  });
});

describe('/sync fallback up', () => {
  it('moves an account one place up', async () => {
    const context = listed([K_LAIN, K_EVE, K_BOB]);

    await command.run('fallback up bob', context);

    expect(context.stores.sync.read().syncAccounts).toStrictEqual([K_LAIN, K_BOB, K_EVE]);
  });

  it('refuses to move the primary or an unlisted account up', async () => {
    const context = listed([K_LAIN, K_EVE]);

    await expect(command.run('fallback up lain', context)).resolves.toStrictEqual(
      refused('Already the primary'),
    );
    await expect(command.run('fallback up bob', context)).resolves.toStrictEqual(
      refused('Not in the sync list'),
    );
  });
});
