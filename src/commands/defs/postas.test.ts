/**
 * Tests for /postas (WFE-281): the definition, the report of who the active
 * window posts as and why, and the refusals: an unknown account, bad words.
 */
import { describe, expect, it } from 'vitest';

import { command } from './postas';
import { ALICE, MAIN, OPEN_HOME, OTHER, desk, openFeed } from '../../test/postasDesk';

describe('/postas', () => {
  it('declares its name, grammar and summary, and no hotkeys', () => {
    expect(command.name).toBe('postas');
    expect(command.usage).toBe('/postas [--global] [<handle|n>|--clear]');
    expect(command.summary).toBe('Show or set which account feeds post as');
    expect(command.bindings).toBeUndefined();
  });

  it('says a feed window posts as its feed default', async () => {
    const session = desk([MAIN, OTHER], null, [openFeed(OTHER)]);

    await expect(session.run('--global')).resolves.toStrictEqual({ ok: true });

    expect(session.printed).toStrictEqual(['~other posts as @lain@wired.example (feed default)']);
  });

  it('says a feed window without a default posts as the global one', async () => {
    const session = desk([MAIN], ALICE.key, [openFeed(MAIN)]);

    await session.run('--global');

    expect(session.printed).toStrictEqual(['~main posts as @alice@wired.example (global default)']);
  });

  it('says who the status window posts as: the global default', async () => {
    const session = desk([], ALICE.key);

    await session.run('--global');

    expect(session.printed).toStrictEqual(['posts as @alice@wired.example (global default)']);
  });

  it('says a window with its own account posts as that account', async () => {
    const session = desk([], ALICE.key, [OPEN_HOME]);

    await session.run('--global');

    expect(session.printed).toStrictEqual(["posts as @lain@wired.example (window's account)"]);
  });

  it('says nothing is set when two accounts and no default leave it open', async () => {
    const session = desk([], null);

    await expect(session.run('--global')).resolves.toStrictEqual({ ok: true });

    expect(session.printed).toStrictEqual(['No posting account set: /postas <handle|n>']);
  });

  it('refuses an account nobody has, changing nothing', async () => {
    const session = desk([MAIN], null, [openFeed(MAIN)]);

    await expect(session.run('nobody')).resolves.toStrictEqual({
      ok: false,
      message: 'No account nobody',
    });

    expect(session.state().settings.feeds).toStrictEqual([MAIN]);
    expect(session.state().settings.postAs).toBeNull();
  });

  it.each([
    ['an unknown flag', '--nope'],
    ['two accounts', 'lain alice'],
    ['--clear with an account', '--clear lain'],
  ])('answers the usage for %s', async (_name, args) => {
    const session = desk([MAIN], null);

    await expect(session.run(args)).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /postas [--global] [<handle|n>|--clear]',
    });
  });
});
