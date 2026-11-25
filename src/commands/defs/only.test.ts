/**
 * Tests for /only: every pane and float but the focused one closes, over a
 * nested tree with floats, from a focused float too; windows stay open; an
 * empty desktop is refused with a message.
 */
import { describe, expect, it } from 'vitest';

import { command } from './only';
import { A, B } from '../../state/layoutSyncFixtures';
import { appWithLayout, layoutHarness } from '../../test/layoutCommand';
import { treeShape } from '../../windows/desktopFixtures';
import { activeDesktop } from '../../windows/desktops';
import type { LayoutAction } from '../../windows/layoutAction';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** Every open window's id, in list order. */
const ALL = [STATUS_WINDOW_ID, A, B];

/** `row(p1:b col(p2:a p4:b))` with a float p3 showing the status window; focus on p4. */
const NESTED: readonly LayoutAction[] = [
  { type: 'split', dir: 'row', windowId: A },
  { type: 'split', dir: 'column', windowId: STATUS_WINDOW_ID },
  { type: 'float' },
  { type: 'split', dir: 'column', windowId: B },
];

describe('/only', () => {
  it('names itself and says how it differs from /close', () => {
    expect(command.name).toBe('only');
    expect(command.summary).toContain('unlike /close');
  });

  it('closes every other pane of a nested tree and every float', async () => {
    const harness = layoutHarness(appWithLayout(...NESTED, { type: 'focusPane', paneId: 'p1' }));

    const outcome = await command.run('', harness.context());

    const { windows, layout } = harness.state();

    expect(outcome).toStrictEqual({ ok: true });
    expect(treeShape(activeDesktop(layout))).toBe(`p1:${B}`);
    expect(activeDesktop(layout).floats).toStrictEqual([]);
    expect(windows.windows.map(({ id }) => id)).toStrictEqual(ALL);
  });

  it('keeps a focused float alone', async () => {
    const harness = layoutHarness(appWithLayout(...NESTED, { type: 'focusPane', paneId: 'p3' }));

    await command.run('', harness.context());

    const desktop = activeDesktop(harness.state().layout);

    expect(desktop.tree).toBeNull();
    expect(desktop.floats.map(({ paneId }) => paneId)).toStrictEqual(['p3']);
    expect(harness.state().windows.activeId).toBe(STATUS_WINDOW_ID);
  });

  it('refuses on an empty desktop with a message', async () => {
    const before = appWithLayout({ type: 'goToDesktop', n: 2 });
    const harness = layoutHarness(before);

    const outcome = await command.run('', harness.context());

    expect(outcome).toStrictEqual({ ok: false, message: 'There are no panes on this desktop' });
    expect(harness.state()).toBe(before);
  });
});
