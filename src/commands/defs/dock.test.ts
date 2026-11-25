/**
 * Tests for /dock: the focused float joins the tree keeping its window, and
 * anything else focused is refused with a message.
 */
import { describe, expect, it } from 'vitest';

import { command } from './dock';
import { A } from '../../state/layoutSyncFixtures';
import { appWithLayout, layoutHarness } from '../../test/layoutCommand';
import { treeShape } from '../../windows/desktopFixtures';
import { activeDesktop } from '../../windows/desktops';

describe('/dock', () => {
  it('declares its name and summary', () => {
    expect(command.name).toBe('dock');
    expect(command.usage).toBe('/dock');
    expect(command.summary).toContain('float');
  });

  it('puts the focused float back in the tree beside the last pane', async () => {
    const harness = layoutHarness(
      appWithLayout({ type: 'split', dir: 'row', windowId: A }, { type: 'float' }),
    );

    const outcome = await command.run('', harness.context());

    const desktop = activeDesktop(harness.state().layout);

    expect(outcome).toStrictEqual({ ok: true });
    expect(desktop.floats).toStrictEqual([]);
    expect(treeShape(desktop)).toContain(A);
    expect(harness.state().windows.activeId).toBe(A);
  });

  it('refuses a focused tiled pane', async () => {
    const harness = layoutHarness(appWithLayout());

    await expect(command.run('', harness.context())).resolves.toStrictEqual({
      ok: false,
      message: 'The focused pane is not a float',
    });
  });

  it('refuses an empty desktop', async () => {
    const harness = layoutHarness(appWithLayout({ type: 'closePane' }));

    await expect(command.run('', harness.context())).resolves.toStrictEqual({
      ok: false,
      message: 'The focused pane is not a float',
    });
  });
});
