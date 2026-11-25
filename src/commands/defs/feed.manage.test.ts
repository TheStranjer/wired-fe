/**
 * Tests for `/feed rename` and `/feed delete` (decision 14): a rename keeps
 * the feed's id and retitles the windows showing it, a delete forgets the feed
 * and closes those windows, and every refusal — unknown feed, a taken or
 * reserved name, wrong words — says why and changes nothing.
 */
import { describe, expect, it } from 'vitest';

import type { Feeds } from '../../state/feeds';
import { LAIN, feedDesk } from '../../test/feedDesk';

const FEEDS: Feeds = [
  { id: 'f1', name: 'main', sources: [{ accountKey: LAIN.key, source: 'home' }] },
  { id: 'f2', name: 'quiet', sources: [] },
];

/** The titles of the windows open, in order. */
function titles(session: ReturnType<typeof feedDesk>): readonly string[] {
  return session.state().windows.windows.map((win) => win.title);
}

describe('/feed rename', () => {
  it('renames the feed, keeping its id and sources, and retitles its window', async () => {
    const session = feedDesk(FEEDS);
    await session.run('main');

    await expect(session.run('rename main ~prime')).resolves.toStrictEqual({ ok: true });

    expect(session.feeds()[0]).toStrictEqual({ ...FEEDS[0], name: 'prime' });
    expect(titles(session)).toStrictEqual(['status', '~prime']);
    expect(session.printed).toStrictEqual(['Renamed ~main to ~prime']);
  });

  it('renames a feed nobody has open, and lets a name change only its case', async () => {
    const session = feedDesk(FEEDS);

    await session.run('rename quiet Quiet');

    expect(session.feeds().map((feed) => feed.name)).toStrictEqual(['main', 'Quiet']);
    expect(titles(session)).toStrictEqual(['status']);
  });

  it('refuses an unknown feed, a taken name and a /feed word', async () => {
    const session = feedDesk(FEEDS);

    await expect(session.run('rename nope x')).resolves.toStrictEqual({
      ok: false,
      message: 'No feed named "nope"',
    });
    await expect(session.run('rename main QUIET')).resolves.toStrictEqual({
      ok: false,
      message: 'A feed named "quiet" already exists',
    });
    await expect(session.run('rename main open')).resolves.toStrictEqual({
      ok: false,
      message: '"open" is a /feed word; pick another name',
    });
    expect(session.feeds()).toStrictEqual(FEEDS);
  });

  it('refuses the wrong number of words', async () => {
    const session = feedDesk(FEEDS);
    const usage = { ok: false, message: 'Usage: /feed rename <old> <new>' };

    await expect(session.run('rename')).resolves.toStrictEqual(usage);
    await expect(session.run('rename main')).resolves.toStrictEqual(usage);
    await expect(session.run('rename main a b')).resolves.toStrictEqual(usage);
  });
});

describe('/feed delete', () => {
  it('forgets the feed and closes the windows showing it, others stay', async () => {
    const session = feedDesk(FEEDS);
    await session.run('main');
    await session.run('quiet');

    await expect(session.run('delete main')).resolves.toStrictEqual({ ok: true });

    expect(session.feeds()).toStrictEqual([FEEDS[1]]);
    expect(titles(session)).toStrictEqual(['status', '~quiet']);
    expect(session.printed).toStrictEqual(['Deleted ~main']);
  });

  it('forgets a feed that has no window open', async () => {
    const session = feedDesk(FEEDS);

    await session.run('delete ~quiet');

    expect(session.feeds()).toStrictEqual([FEEDS[0]]);
  });

  it('refuses an unknown feed and the wrong number of words', async () => {
    const session = feedDesk(FEEDS);

    await expect(session.run('delete nope')).resolves.toStrictEqual({
      ok: false,
      message: 'No feed named "nope"',
    });
    await expect(session.run('delete')).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /feed delete <name>',
    });
    await expect(session.run('delete main quiet')).resolves.toMatchObject({ ok: false });
    expect(session.feeds()).toStrictEqual(FEEDS);
  });
});
