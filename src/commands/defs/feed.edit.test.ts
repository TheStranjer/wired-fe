/**
 * Tests for `/feed edit` (decision 13 and 14): it opens the editor window of a
 * saved feed, activates the one already open, and refuses an unknown feed or
 * the wrong words; renaming a feed retitles its editor and deleting it closes
 * the editor with the feed's window.
 */
import { describe, expect, it } from 'vitest';

import type { Feeds } from '../../state/feeds';
import { feedDesk } from '../../test/feedDesk';

const FEEDS: Feeds = [
  { id: 'f1', name: 'main', sources: [] },
  { id: 'f2', name: 'quiet', sources: [] },
];

/** The titles of the windows open, in order. */
function titles(session: ReturnType<typeof feedDesk>): readonly string[] {
  return session.state().windows.windows.map((win) => win.title);
}

describe('/feed edit', () => {
  it('opens the editor of the feed, whose target is the feed id', async () => {
    const session = feedDesk(FEEDS);

    await expect(session.run('edit ~main')).resolves.toStrictEqual({ ok: true });

    const editor = session.state().windows.windows[1];

    expect(editor?.title).toBe('edit ~main');
    expect(editor?.ref).toStrictEqual({ kind: 'feedEditor', accountKey: null, target: 'f1' });
  });

  it('activates the editor that is already open instead of opening another', async () => {
    const session = feedDesk(FEEDS);
    await session.run('edit main');
    await session.run('quiet');

    await session.run('edit MAIN');

    expect(titles(session)).toStrictEqual(['status', 'edit ~main', '~quiet']);
    expect(session.state().windows.activeId).toBe('feedEditor:-:f1');
  });

  it('refuses an unknown feed and the wrong number of words', async () => {
    const session = feedDesk(FEEDS);

    await expect(session.run('edit nope')).resolves.toStrictEqual({
      ok: false,
      message: 'No feed named "nope"',
    });
    await expect(session.run('edit')).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /feed edit <name>',
    });
    await expect(session.run('edit main quiet')).resolves.toMatchObject({ ok: false });
    expect(titles(session)).toStrictEqual(['status']);
  });

  it('is retitled by a rename of its feed, next to the feed window', async () => {
    const session = feedDesk(FEEDS);
    await session.run('main');
    await session.run('edit main');

    await session.run('rename main prime');

    expect(titles(session)).toStrictEqual(['status', '~prime', 'edit ~prime']);
  });

  it('is closed by a delete of its feed, others stay', async () => {
    const session = feedDesk(FEEDS);
    await session.run('edit main');
    await session.run('edit quiet');

    await session.run('delete main');

    expect(titles(session)).toStrictEqual(['status', 'edit ~quiet']);
  });
});
