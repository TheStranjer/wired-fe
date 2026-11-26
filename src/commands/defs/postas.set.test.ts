/**
 * Tests for /postas setting and clearing (WFE-281): the feed default and the
 * global one, in a feed window, a window of its own account and the status
 * window, with `--global` and `--clear`.
 */
import { describe, expect, it } from 'vitest';

import { ALICE, LAIN, MAIN, OPEN_HOME, OTHER, desk, openFeed } from '../../test/postasDesk';

describe('/postas <handle|n>', () => {
  it('sets the feed default in a feed window and reports it', async () => {
    const session = desk([MAIN, OTHER], null, [openFeed(MAIN)]);

    await expect(session.run('alice')).resolves.toStrictEqual({ ok: true });

    expect(session.state().settings.feeds).toStrictEqual([{ ...MAIN, postAs: ALICE.key }, OTHER]);
    expect(session.state().settings.postAs).toBeNull();
    expect(session.printed).toStrictEqual(['~main posts as @alice@wired.example (feed default)']);
  });

  it('names the account by number too', async () => {
    const session = desk([MAIN], null, [openFeed(MAIN)]);

    await session.run('2');

    expect(session.state().settings.feeds[0]?.postAs).toBe(ALICE.key);
  });

  it('sets the global default outside a feed window', async () => {
    const session = desk([MAIN], null);

    await session.run('@alice@wired.example');

    expect(session.state().settings.postAs).toBe(ALICE.key);
    expect(session.state().settings.feeds).toStrictEqual([MAIN]);
    expect(session.printed).toStrictEqual(['posts as @alice@wired.example (global default)']);
  });

  it('sets the global default from a feed window with --global, in either word order', async () => {
    const session = desk([MAIN], null, [openFeed(MAIN)]);

    await session.run('--global alice');

    expect(session.state().settings.postAs).toBe(ALICE.key);

    await session.run('lain --global');

    expect(session.state().settings.postAs).toBe(LAIN.key);
    expect(session.state().settings.feeds).toStrictEqual([MAIN]);
  });

  it('sets the global default from a window of its own account, and says so', async () => {
    const session = desk([MAIN], null, [OPEN_HOME]);

    await session.run('alice');

    expect(session.state().settings.postAs).toBe(ALICE.key);
    expect(session.printed).toStrictEqual([
      'posts as @alice@wired.example (global default); this window has its own account, so it is the global default',
    ]);
  });

  it('sets the global default quietly from a window of its own account with --global', async () => {
    const session = desk([], null, [OPEN_HOME]);

    await session.run('--global alice');

    expect(session.printed).toStrictEqual(['posts as @alice@wired.example (global default)']);
  });

  it('sets the global default when the feed window shows a feed that is gone', async () => {
    const session = desk([], null, [openFeed(MAIN)]);

    await session.run('alice');

    expect(session.state().settings.postAs).toBe(ALICE.key);
  });
});

describe('/postas --clear', () => {
  it('clears the default of the feed in a feed window and leaves the global one', async () => {
    const session = desk([OTHER], ALICE.key, [openFeed(OTHER)]);

    await expect(session.run('--clear')).resolves.toStrictEqual({ ok: true });

    expect(session.state().settings.feeds[0]?.postAs).toBeUndefined();
    expect(session.state().settings.postAs).toBe(ALICE.key);
    expect(session.printed).toStrictEqual(['~other default cleared']);
  });

  it('clears the global default outside a feed window', async () => {
    const session = desk([OTHER], ALICE.key);

    await session.run('--clear');

    expect(session.state().settings.postAs).toBeNull();
    expect(session.state().settings.feeds[0]?.postAs).toBe(LAIN.key);
    expect(session.printed).toStrictEqual(['Global posting account cleared']);
  });

  it('clears only the global default with --clear --global in a feed window', async () => {
    const session = desk([OTHER], ALICE.key, [openFeed(OTHER)]);

    await session.run('--clear --global');

    expect(session.state().settings.postAs).toBeNull();
    expect(session.state().settings.feeds[0]?.postAs).toBe(LAIN.key);
  });

  it('clears the global default from a window of its own account', async () => {
    const session = desk([], ALICE.key, [OPEN_HOME]);

    await session.run('--clear');

    expect(session.state().settings.postAs).toBeNull();
  });
});
