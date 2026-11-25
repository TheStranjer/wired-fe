/**
 * Tests for placement through the real open commands (decision 13), over the
 * real app reducer: a trailing `--in <placement>` puts the window of `/tag`,
 * `/home`, `/query`, `/search` and `/compose` in a split, a float or nowhere
 * in particular; `/set openIn` and `/set openIn.<kind>` do the same for every
 * open, with `--in` over the kind's setting over the default; a bad `--in`
 * opens nothing; and `/vsplit`, which places its window itself, is not
 * moved by any of it.
 */
import { describe, expect, it } from 'vitest';

import { command as compose } from './compose';
import { command as home } from './home';
import { command as query } from './query';
import { command as search } from './search';
import { command as set } from './set';
import { command as tag } from './tag';
import { command as vsplit } from './vsplit';
import { LAIN, desk, direction, shown, tagId } from '../../test/splitDesk';
import { activeDesktop, focusedWindowId } from '../../windows/desktops';
import { STATUS_WINDOW_ID, windowId } from '../../windows/model';

/** The home window of {@link LAIN}. */
const HOME_ID = windowId({ kind: 'home', accountKey: LAIN.key, target: null });

describe('--in on the open commands', () => {
  it('splits side by side for vsplit and focuses the new pane', async () => {
    const session = desk([LAIN]);

    await expect(session.run(tag, 'rust --in vsplit')).resolves.toStrictEqual({ ok: true });

    expect(direction(session.state())).toBe('row');
    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID, tagId(LAIN, 'rust')]);
    expect(focusedWindowId(session.state().layout)).toBe(tagId(LAIN, 'rust'));
  });

  it('stacks the new pane for split', async () => {
    const session = desk([LAIN]);

    await session.run(query, '@alice --in split');

    expect(direction(session.state())).toBe('column');
    expect(session.state().windows.windows.map((win) => win.title)).toStrictEqual([
      'status',
      'dm/alice',
    ]);
  });

  it('opens a float for float, in the account windows too', async () => {
    const session = desk([LAIN]);

    await session.run(home, '--in float');
    const { floats } = activeDesktop(session.state().layout);

    expect(floats.map((float) => float.windowId)).toStrictEqual([HOME_ID]);
    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID]);
    expect(session.state().windows.activeId).toBe(HOME_ID);
  });

  it('opens the window without showing or focusing it for hidden', async () => {
    const session = desk([LAIN]);

    await session.run(search, 'rust lang --in hidden');
    const state = session.state();

    expect(state.windows.windows.map((win) => win.title)).toStrictEqual([
      'status',
      'search/rust lang',
    ]);
    expect(state.windows.activeId).toBe(STATUS_WINDOW_ID);
    expect(shown(state)).toStrictEqual([STATUS_WINDOW_ID]);
  });

  it('opens a composer where it is told', async () => {
    const session = desk([LAIN]);

    await session.run(compose, '--in vsplit');

    expect(direction(session.state())).toBe('row');
    expect(session.state().windows.windows).toHaveLength(2);
  });

  it('refuses a placement it does not know, and opens nothing', async () => {
    const session = desk([LAIN]);

    const outcome = await session.run(tag, 'rust --in sideways');

    expect(outcome).toStrictEqual({
      ok: false,
      message: '--in takes here|vsplit|split|float|hidden',
    });
    expect(session.state().windows.windows).toHaveLength(1);
  });
});

describe('the settings that place every open', () => {
  it('opens where openIn says when nothing else does', async () => {
    const session = desk([LAIN]);
    await session.run(set, 'openIn vsplit');

    await session.run(tag, 'rust');

    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID, tagId(LAIN, 'rust')]);
    expect(direction(session.state())).toBe('row');
  });

  it('opens where the kind’s own setting says over openIn', async () => {
    const session = desk([LAIN]);
    await session.run(set, 'openIn vsplit');
    await session.run(set, 'openIn.hashtag float');

    await session.run(tag, 'rust');

    expect(activeDesktop(session.state().layout).floats).toHaveLength(1);
    expect(direction(session.state())).toBe('pane');
  });

  it('floats a composer by default, whatever openIn says', async () => {
    const session = desk([LAIN]);
    await session.run(set, 'openIn vsplit');

    await session.run(compose, '');

    expect(activeDesktop(session.state().layout).floats).toHaveLength(1);
    expect(direction(session.state())).toBe('pane');
  });

  it('opens where --in says over both', async () => {
    const session = desk([LAIN]);
    await session.run(set, 'openIn vsplit');
    await session.run(set, 'openIn.hashtag float');

    await session.run(tag, 'rust --in here');

    expect(shown(session.state())).toStrictEqual([tagId(LAIN, 'rust')]);
    expect(activeDesktop(session.state().layout).floats).toHaveLength(0);
  });

  it('does not move /vsplit, which places its window in the pane it makes', async () => {
    const session = desk([LAIN]);
    await session.run(set, 'openIn float');

    await session.run(vsplit, 'tag rust --in hidden');

    expect(direction(session.state())).toBe('row');
    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID, tagId(LAIN, 'rust')]);
    expect(activeDesktop(session.state().layout).floats).toHaveLength(0);
  });
});
