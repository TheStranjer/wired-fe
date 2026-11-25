/**
 * Tests for `/feed new`, `/feed add` and `/feed rm` (decision 14): feeds are
 * saved into the settings with sources read from the command grammar (`*`
 * naming every signed-in account), ids made from the ids already used, and every
 * refusal — a bad source, an unknown or taken name, wrong words — saying why
 * and saving nothing.
 */
import { describe, expect, it } from 'vitest';

import type { Feeds } from '../../state/feeds';
import { ALICE, LAIN, feedDesk } from '../../test/feedDesk';

describe('/feed new', () => {
  it('saves a feed with f1 as its id and the sources of every account a * names', async () => {
    const desk = feedDesk();

    await expect(
      desk.run('new main *:home *:mentions lain@wired.example:dms @alice@wired.example:tag:rust'),
    ).resolves.toStrictEqual({ ok: true });

    expect(desk.feeds()).toStrictEqual([
      {
        id: 'f1',
        name: 'main',
        sources: [
          { accountKey: LAIN.key, source: 'home' },
          { accountKey: ALICE.key, source: 'home' },
          { accountKey: LAIN.key, source: 'mentions' },
          { accountKey: ALICE.key, source: 'mentions' },
          { accountKey: LAIN.key, source: 'dms' },
          { accountKey: ALICE.key, source: 'tag:rust' },
        ],
      },
    ]);
    expect(desk.printed).toStrictEqual(['Made ~main']);
  });

  it('numbers the next feed one past the largest id in use', async () => {
    const desk = feedDesk([{ id: 'f4', name: 'old', sources: [] }]);

    await desk.run('new fresh');

    expect(desk.feeds().map((feed) => feed.id)).toStrictEqual(['f4', 'f5']);
  });

  it('takes a name written with its tilde and keeps a feed with no sources', async () => {
    const desk = feedDesk();

    await desk.run('new ~quiet');

    expect(desk.feeds()).toStrictEqual([{ id: 'f1', name: 'quiet', sources: [] }]);
  });

  it('refuses a name another feed has, ignoring case', async () => {
    const desk = feedDesk([{ id: 'f1', name: 'Main', sources: [] }]);

    const outcome = await desk.run('new main *:home');

    expect(outcome).toStrictEqual({ ok: false, message: 'A feed named "Main" already exists' });
    expect(desk.feeds()).toHaveLength(1);
  });

  it('refuses a source that is not one and saves nothing', async () => {
    const desk = feedDesk();

    const outcome = await desk.run('new main *:home *:bogus');

    expect(outcome).toMatchObject({ ok: false });
    expect(outcome.ok ? '' : outcome.message).toContain('Not a source: "*:bogus"');
    expect(desk.feeds()).toStrictEqual([]);
  });

  it('refuses a source of an account that is not signed in', async () => {
    const desk = feedDesk();

    await expect(desk.run('new main @nobody@wired.example:home')).resolves.toStrictEqual({
      ok: false,
      message: 'No signed-in account @nobody@wired.example',
    });
  });

  it('refuses a name that is a /feed word, so /feed <name> always opens', async () => {
    const desk = feedDesk();

    await expect(desk.run('new LIST *:home')).resolves.toStrictEqual({
      ok: false,
      message: '"LIST" is a /feed word; pick another name',
    });
  });

  it('refuses a name too long and a missing name', async () => {
    const desk = feedDesk();

    await expect(desk.run(`new ${'x'.repeat(33)}`)).resolves.toStrictEqual({
      ok: false,
      message: 'A feed name is 1-32 characters',
    });
    await expect(desk.run('new')).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /feed new <name> <source>…',
    });
  });
});

describe('/feed add', () => {
  const MAIN: Feeds = [
    { id: 'f1', name: 'main', sources: [{ accountKey: LAIN.key, source: 'home' }] },
  ];

  it('reads more sources in the feed, keeping an identical one once', async () => {
    const desk = feedDesk([
      { id: 'f1', name: 'main', sources: [{ accountKey: LAIN.key, source: 'home' }] },
    ]);

    await expect(desk.run('add MAIN *:home local')).resolves.toMatchObject({ ok: false });
    await expect(desk.run('add MAIN *:home *:local')).resolves.toStrictEqual({ ok: true });

    expect(desk.feeds()[0]?.sources).toStrictEqual([
      { accountKey: LAIN.key, source: 'home' },
      { accountKey: ALICE.key, source: 'home' },
      { accountKey: LAIN.key, source: 'local' },
      { accountKey: ALICE.key, source: 'local' },
    ]);
    expect(desk.printed).toStrictEqual(['~main reads *:home *:local']);
  });

  it('refuses an unknown feed, a bad source and missing words', async () => {
    const desk = feedDesk(MAIN);

    await expect(desk.run('add nope *:home')).resolves.toStrictEqual({
      ok: false,
      message: 'No feed named "nope"',
    });
    await expect(desk.run('add main nonsense')).resolves.toMatchObject({ ok: false });
    await expect(desk.run('add main')).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /feed add <name> <source>…',
    });
    await expect(desk.run('add')).resolves.toMatchObject({ ok: false });
    expect(desk.feeds()).toStrictEqual(MAIN);
  });
});

describe('/feed rm', () => {
  const FULL: Feeds = [
    {
      id: 'f1',
      name: 'main',
      sources: [
        { accountKey: LAIN.key, source: 'home' },
        { accountKey: ALICE.key, source: 'home' },
        { accountKey: LAIN.key, source: 'dms' },
      ],
    },
  ];

  it('stops reading the sources, expanding * and skipping those the feed never read', async () => {
    const desk = feedDesk(FULL);

    await expect(desk.run('rm main *:home alice@wired.example:dms')).resolves.toStrictEqual({
      ok: true,
    });

    expect(desk.feeds()[0]?.sources).toStrictEqual([{ accountKey: LAIN.key, source: 'dms' }]);
    expect(desk.printed).toStrictEqual(['~main no longer reads *:home alice@wired.example:dms']);
  });

  it('refuses when the feed reads none of the sources', async () => {
    const desk = feedDesk(FULL);

    await expect(desk.run('rm main *:local')).resolves.toStrictEqual({
      ok: false,
      message: '~main reads none of *:local',
    });
    expect(desk.feeds()).toStrictEqual(FULL);
  });

  it('refuses an unknown feed, a bad source and missing words', async () => {
    const desk = feedDesk(FULL);

    await expect(desk.run('rm nope *:home')).resolves.toStrictEqual({
      ok: false,
      message: 'No feed named "nope"',
    });
    await expect(desk.run('rm main nonsense')).resolves.toMatchObject({ ok: false });
    await expect(desk.run('rm main')).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /feed rm <name> <source>…',
    });
    await expect(desk.run('rm')).resolves.toMatchObject({ ok: false });
  });
});
