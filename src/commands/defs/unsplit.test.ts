/**
 * Tests for /unsplit: the focused pane or float closes, its window stays
 * open and listed, the last pane leaves an empty desktop, and an empty
 * desktop is refused with a message.
 */
import { describe, expect, it } from 'vitest';

import { command } from './unsplit';
import { A, B } from '../../state/layoutSyncFixtures';
import { appWithLayout, layoutHarness } from '../../test/layoutCommand';
import { treeShape } from '../../windows/desktopFixtures';
import { activeDesktop } from '../../windows/desktops';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** Every open window's id, in list order. */
const ALL = [STATUS_WINDOW_ID, A, B];

describe('/unsplit', () => {
  it('names itself, answers to /pclose and says how it differs from /close', () => {
    expect(command.aliases).toStrictEqual(['pclose']);
    expect(command.summary).toContain('unlike /close');
  });

  it('closes the focused pane of two, keeping its window open', async () => {
    const harness = layoutHarness(appWithLayout({ type: 'split', dir: 'row', windowId: A }));

    const outcome = await command.run('', harness.context());

    const { windows, layout } = harness.state();

    expect(outcome).toStrictEqual({ ok: true });
    expect(treeShape(activeDesktop(layout))).toBe(`p1:${B}`);
    expect(windows.windows.map(({ id }) => id)).toStrictEqual(ALL);
    expect(windows.activeId).toBe(B);
  });

  it('closes a focused float', async () => {
    const harness = layoutHarness(
      appWithLayout({ type: 'split', dir: 'row', windowId: A }, { type: 'float' }),
    );

    const outcome = await command.run('', harness.context());

    const { windows, layout } = harness.state();

    expect(outcome).toStrictEqual({ ok: true });
    expect(activeDesktop(layout).floats).toStrictEqual([]);
    expect(treeShape(activeDesktop(layout))).toBe(`p1:${B}`);
    expect(windows.windows.map(({ id }) => id)).toStrictEqual(ALL);
  });

  it('leaves the desktop empty after the last pane, then refuses on it', async () => {
    const harness = layoutHarness(appWithLayout());

    const first = await command.run('', harness.context());
    const afterFirst = harness.state();
    const second = await command.run('', harness.context());

    expect(first).toStrictEqual({ ok: true });
    expect(activeDesktop(afterFirst.layout).tree).toBeNull();
    expect(afterFirst.windows.windows.map(({ id }) => id)).toStrictEqual(ALL);
    expect(second).toStrictEqual({
      ok: false,
      message: 'There is no pane to close on this desktop',
    });
    expect(harness.state()).toBe(afterFirst);
  });
});
