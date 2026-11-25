/**
 * Tests for /float: the focused tiled pane tears off into a float, a view
 * spec opens its window in a new focused float, the refusals say why nothing
 * happened, and a float then /dock round trip keeps the window. Move and size
 * are in float.adjust.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command as dock } from './dock';
import { command } from './float';
import { command as tag } from './tag';
import { command as vsplit } from './vsplit';
import { A, B } from '../../state/layoutSyncFixtures';
import { appWithLayout, layoutHarness } from '../../test/layoutCommand';
import { LAIN, desk, shown, tagId } from '../../test/splitDesk';
import { treeShape } from '../../windows/desktopFixtures';
import { activeDesktop, focusedWindowId } from '../../windows/desktops';
import { STATUS_WINDOW_ID } from '../../windows/model';

describe('/float', () => {
  it('declares its name, grammar and summary', () => {
    expect(command.name).toBe('float');
    expect(command.usage).toMatch(
      /^\/float \[home\|.*\| \/float move <dx> <dy> \| size <dw> <dh>$/u,
    );
    expect(command.summary).toContain('float');
  });

  it('tears the focused pane off into a float that keeps its window', async () => {
    const harness = layoutHarness(appWithLayout({ type: 'split', dir: 'row', windowId: A }));

    const outcome = await command.run('', harness.context());

    const { floats, focusedPaneId } = activeDesktop(harness.state().layout);

    expect(outcome).toStrictEqual({ ok: true });
    expect(floats.map((float) => float.windowId)).toStrictEqual([A]);
    expect(focusedPaneId).toBe(floats[0]?.paneId);
    expect(treeShape(activeDesktop(harness.state().layout))).toBe(`p1:${B}`);
    expect(harness.state().windows.activeId).toBe(A);
  });

  it('refuses a focused float', async () => {
    const harness = layoutHarness(
      appWithLayout({ type: 'split', dir: 'row', windowId: A }, { type: 'float' }),
    );

    await expect(command.run('', harness.context())).resolves.toStrictEqual({
      ok: false,
      message: 'The focused pane is already a float',
    });
  });

  it('refuses an empty desktop', async () => {
    const harness = layoutHarness(appWithLayout({ type: 'closePane' }));

    await expect(command.run(' ', harness.context())).resolves.toStrictEqual({
      ok: false,
      message: 'There is no pane to float on this desktop',
    });
  });

  it('opens a view in a new focused float and leaves the tiled panes alone', async () => {
    const session = desk([LAIN]);

    await expect(session.run(command, 'tag rust')).resolves.toStrictEqual({ ok: true });

    const state = session.state();
    const { floats } = activeDesktop(state.layout);

    expect(floats.map((float) => float.windowId)).toStrictEqual([tagId(LAIN, 'rust')]);
    expect(shown(state)).toStrictEqual([STATUS_WINDOW_ID]);
    expect(focusedWindowId(state.layout)).toBe(tagId(LAIN, 'rust'));
    expect(state.windows.activeId).toBe(tagId(LAIN, 'rust'));
  });

  it('opens a view in a float from a desktop that has only floats', async () => {
    const session = desk([LAIN]);
    await session.run(command, '');
    await session.run(command, 'tag rust');

    const { floats, tree } = activeDesktop(session.state().layout);

    expect(tree).toBeNull();
    expect(floats.map((float) => float.windowId)).toStrictEqual([
      STATUS_WINDOW_ID,
      tagId(LAIN, 'rust'),
    ]);
  });

  it('shows an existing window by number in a new float', async () => {
    const session = desk([LAIN]);
    await session.run(tag, 'rust');

    await session.run(command, 'win 1');

    const { floats } = activeDesktop(session.state().layout);

    expect(floats.map((float) => float.windowId)).toStrictEqual([STATUS_WINDOW_ID]);
    expect(session.state().windows.windows).toHaveLength(2);
  });

  it('echoes the usage for an unknown view and floats nothing', async () => {
    const session = desk([LAIN]);

    const outcome = await session.run(command, 'bogus');

    expect(outcome).toStrictEqual({
      ok: false,
      message: expect.stringMatching(/^Unknown view: bogus\. Usage: \/float /u) as string,
    });
    expect(activeDesktop(session.state().layout).floats).toStrictEqual([]);
  });

  it('says why a view that cannot open opens nothing', async () => {
    const session = desk([LAIN]);

    await expect(session.run(command, 'win 9')).resolves.toStrictEqual({
      ok: false,
      message: 'No window 9',
    });
    expect(activeDesktop(session.state().layout).floats).toStrictEqual([]);
  });

  it('floats and docks back with the same window', async () => {
    const session = desk([LAIN]);
    await session.run(vsplit, 'tag rust');
    const before = shown(session.state());

    await session.run(command, '');

    expect(shown(session.state())).toStrictEqual([STATUS_WINDOW_ID]);
    expect(activeDesktop(session.state().layout).floats).toHaveLength(1);

    await session.run(dock, '');

    expect(shown(session.state())).toStrictEqual(before);
    expect(activeDesktop(session.state().layout).floats).toStrictEqual([]);
    expect(session.state().windows.windows).toHaveLength(2);
  });
});
