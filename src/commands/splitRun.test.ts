/**
 * Tests for the run `/vsplit` and `/split` share (decisions 12 and 13), over
 * the real app reducer and the real open commands: no argument shows the same
 * window in the new pane; a view spec opens its window in the new pane, as
 * the account the commands act as; and a window that is already open is shown
 * rather than opened twice. The refusals are in splitRun.refusals.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command as split } from './defs/split';
import { command as tag } from './defs/tag';
import { command as vsplit } from './defs/vsplit';
import { OK } from './outcome';
import { ALICE, LAIN, desk, direction, shown, stub, tagId } from '../test/splitDesk';
import { focusedWindowId } from '../windows/desktops';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';

describe('/vsplit and /split with no argument', () => {
  it('shows the focused window in a new pane beside it and focuses that pane', async () => {
    const session = desk([LAIN]);

    await expect(session.run(vsplit, '')).resolves.toStrictEqual(OK);

    expect(direction(session.state())).toBe('row');
    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID, STATUS_WINDOW_ID]);
    expect(focusedWindowId(session.state().layout)).toBe(STATUS_WINDOW_ID);
    expect(session.state().windows.windows).toHaveLength(1);
  });

  it('stacks the new pane for /split', async () => {
    const session = desk([LAIN]);

    await expect(session.run(split, '  ')).resolves.toStrictEqual(OK);

    expect(direction(session.state())).toBe('column');
    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID, STATUS_WINDOW_ID]);
  });

  it('duplicates the window the focused pane shows, not window 1', async () => {
    const session = desk([LAIN]);
    await session.run(tag, 'rust');

    await session.run(vsplit, '');

    expect(shown(session.state())).toStrictEqual([tagId(LAIN, 'rust'), tagId(LAIN, 'rust')]);
  });
});

describe('/vsplit and /split with a view', () => {
  it('opens /split tag rust in a stacked pane under the pane it split', async () => {
    const session = desk([LAIN]);

    await session.run(split, 'tag rust');
    const state = session.state();

    expect(direction(state)).toBe('column');
    expect(shown(state)).toStrictEqual([STATUS_WINDOW_ID, tagId(LAIN, 'rust')]);
    expect(focusedWindowId(state.layout)).toBe(tagId(LAIN, 'rust'));
    expect(state.windows.activeId).toBe(tagId(LAIN, 'rust'));
    expect(state.windows.windows.map((win) => win.title)).toStrictEqual(['status', '#rust']);
  });

  it('opens /vsplit home beside the pane, keeping what that pane showed', async () => {
    const session = desk([LAIN]);
    await session.run(tag, 'rust');

    await session.run(vsplit, 'home');

    expect(direction(session.state())).toBe('row');
    expect(shown(session.state())).toStrictEqual([
      tagId(LAIN, 'rust'),
      windowId({ kind: 'home', accountKey: LAIN.key, target: null }),
    ]);
  });

  it('opens dm @x as the private conversation window', async () => {
    const session = desk([LAIN]);

    await session.run(vsplit, 'dm @Alice@wired.example');

    expect(shown(session.state())).toStrictEqual([
      STATUS_WINDOW_ID,
      windowId({ kind: 'dm', accountKey: LAIN.key, target: 'alice@wired.example' }),
    ]);
  });

  it('opens the view for the account the command acts as', async () => {
    const session = desk([LAIN, ALICE]);

    await session.run(vsplit, 'tag rust');

    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID, tagId(ALICE, 'rust')]);
  });

  it('shows a view that is already open in the new pane instead of opening it twice', async () => {
    const session = desk([LAIN]);
    await session.run(tag, 'rust');

    await session.run(vsplit, 'tag rust');

    expect(shown(session.state())).toStrictEqual([tagId(LAIN, 'rust'), tagId(LAIN, 'rust')]);
    expect(session.state().windows.windows).toHaveLength(2);
  });

  it('shows the numbered window for win N, which opens nothing', async () => {
    const session = desk([LAIN]);
    await session.run(tag, 'rust');

    await session.run(split, 'win 1');

    expect(shown(session.state())).toStrictEqual([tagId(LAIN, 'rust'), STATUS_WINDOW_ID]);
    expect(session.state().windows.activeId).toBe(STATUS_WINDOW_ID);
    expect(session.state().windows.windows).toHaveLength(2);
  });

  it('hands the rest of the line to the command behind whois and profile', async () => {
    const seen: string[] = [];
    const whois = stub('whois', OK, (args, dispatchWindows) => {
      seen.push(args);
      dispatchWindows({
        type: 'open',
        ref: { kind: 'profile', accountKey: LAIN.key, target: '7' },
        title: '@x',
      });
    });
    const session = desk([LAIN], [whois]);

    await session.run(vsplit, 'profile @x@wired.example');
    await session.run(split, 'whois');

    expect(seen).toStrictEqual(['@x@wired.example', '']);
    expect(shown(session.state())).toStrictEqual([
      STATUS_WINDOW_ID,
      windowId({ kind: 'profile', accountKey: LAIN.key, target: '7' }),
      windowId({ kind: 'profile', accountKey: LAIN.key, target: '7' }),
    ]);
  });
});
