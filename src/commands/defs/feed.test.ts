/**
 * Tests for `/feed`, `/feed list` and `/feed open` (decision 14): the
 * definition the command line and /help read, the list of every feed with its
 * sources, opening — or activating — a feed's window by `/feed open <name>` or
 * `/feed <name>`, and `/vsplit feed <name>` showing it in a new pane.
 */
import { describe, expect, it } from 'vitest';

import { command } from './feed';
import { command as vsplit } from './vsplit';
import type { Feeds } from '../../state/feeds';
import { ALICE, LAIN, feedDesk } from '../../test/feedDesk';
import { desk, shown } from '../../test/splitDesk';
import { STATUS_WINDOW_ID, windowId } from '../../windows/model';
import { FEED_SUBCOMMANDS } from '../feedArgs';

const FEEDS: Feeds = [
  {
    id: 'f1',
    name: 'main',
    sources: [
      { accountKey: LAIN.key, source: 'home' },
      { accountKey: ALICE.key, source: 'tag:rust' },
    ],
  },
  { id: 'f2', name: 'quiet', sources: [] },
  { id: 'f3', name: 'ghost', sources: [{ accountKey: 'gone', source: 'local' }] },
];

/** The id of the window showing the feed {@link id}. */
function feedWindow(id: string): string {
  return windowId({ kind: 'feed', accountKey: null, target: id });
}

describe('/feed definition', () => {
  it('declares its name, grammar and the subcommands completion offers', () => {
    expect(command.name).toBe('feed');
    expect(command.usage).toContain('/feed rename <old> <new>');
    expect(command.summary).toContain('list, new, add, rm, rename, delete, open');
    expect(FEED_SUBCOMMANDS).toHaveLength(7);
  });
});

describe('/feed list', () => {
  it('prints every feed with its id and the sources as handles, bare /feed too', async () => {
    const desk1 = feedDesk(FEEDS);

    const first = await desk1.run('');
    await desk1.run('LIST');

    const lines = [
      '~main (f1): @lain@wired.example:home @alice@wired.example:tag:rust',
      '~quiet (f2): no sources',
      '~ghost (f3): ?:local',
    ];

    expect(first).toStrictEqual({ ok: true });
    expect(desk1.printed).toStrictEqual([...lines, ...lines]);
  });

  it('says how to make a feed when there is none', async () => {
    const empty = feedDesk();

    await empty.run('list');

    expect(empty.printed).toStrictEqual(['No feeds. Make one with /feed new <name> <source>…']);
  });
});

describe('/feed open', () => {
  it.each(['open main', 'main', 'OPEN ~Main', '~main'])(
    'opens the feed window titled ~main for %j',
    async (args) => {
      const session = feedDesk(FEEDS);

      await expect(session.run(args)).resolves.toStrictEqual({ ok: true });

      const { windows, activeId } = session.state().windows;

      expect(activeId).toBe(feedWindow('f1'));
      expect(windows.map((win) => win.title)).toStrictEqual(['status', '~main']);
    },
  );

  it('activates the window that already shows the feed instead of opening a second', async () => {
    const session = feedDesk(FEEDS);
    await session.run('main');
    await session.run('quiet');

    await session.run('main');

    expect(session.state().windows.windows).toHaveLength(3);
    expect(session.state().windows.activeId).toBe(feedWindow('f1'));
  });

  it('refuses an unknown feed and the wrong number of words', async () => {
    const session = feedDesk(FEEDS);

    await expect(session.run('nope')).resolves.toStrictEqual({
      ok: false,
      message: 'No feed named "nope"',
    });
    await expect(session.run('open')).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /feed open <name>',
    });
    await expect(session.run('open main quiet')).resolves.toMatchObject({ ok: false });
    expect(session.state().windows.windows).toHaveLength(1);
  });
});

describe('/vsplit feed', () => {
  it('opens the feed in the new pane beside the focused one', async () => {
    const session = desk([LAIN], [command]);
    await session.run(command, 'new main *:home');

    await expect(session.run(vsplit, 'feed main')).resolves.toStrictEqual({ ok: true });

    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID, feedWindow('f1')]);
  });

  it('does not make a feed or split when the spec names another subcommand', async () => {
    const session = desk([LAIN], [command]);

    await expect(session.run(vsplit, 'feed new x *:home')).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /feed open <name>',
    });

    expect(session.state().settings.feeds).toStrictEqual([]);
    expect(session.state().windows.windows).toHaveLength(1);
  });
});
