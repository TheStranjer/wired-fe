/**
 * Tests for bare `/postas` (WFE-282): it opens the account picker on the
 * active window instead of printing, and refuses when nobody is signed in.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './postas';
import { NOT_LOGGED_IN_MESSAGE } from '../../lib/refusal';
import { fakeCommandContext } from '../../test/commandContext';
import { MAIN, desk, openFeed } from '../../test/postasDesk';
import { STATUS_WINDOW_ID, activeWindow } from '../../windows/model';

describe('/postas with no arguments', () => {
  it('opens the picker on the active window and prints nothing', async () => {
    const session = desk([MAIN], null, [openFeed(MAIN)]);

    await expect(session.run('')).resolves.toStrictEqual({ ok: true });

    expect(session.state().accountPick).toStrictEqual({
      purpose: 'default',
      windowId: activeWindow(session.state().windows).id,
    });
    expect(session.printed).toStrictEqual([]);
  });

  it('opens it for blank arguments too', async () => {
    const session = desk([], null);

    await session.run('  ');

    expect(session.state().accountPick).toStrictEqual({
      purpose: 'default',
      windowId: STATUS_WINDOW_ID,
    });
  });

  it('refuses with the not-logged-in message and opens nothing when nobody is signed in', async () => {
    const dispatch = vi.fn();

    const outcome = await command.run('', fakeCommandContext({ dispatch }));

    expect(outcome).toStrictEqual({ ok: false, message: NOT_LOGGED_IN_MESSAGE });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
