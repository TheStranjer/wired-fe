/**
 * Tests for /raise: a focused float goes to the top of the floats, a tiled
 * pane is a quiet no-op, and an empty desktop is refused with a message.
 */
import { describe, expect, it } from 'vitest';

import { command } from './raise';
import { A } from '../../state/layoutSyncFixtures';
import { appWithLayout, layoutHarness } from '../../test/layoutCommand';
import { activeDesktop } from '../../windows/desktops';

describe('/raise', () => {
  it('declares its name and summary', () => {
    expect(command.name).toBe('raise');
    expect(command.usage).toBe('/raise');
    expect(command.summary).toContain('top');
  });

  it('brings the focused float to the top', async () => {
    const harness = layoutHarness(
      appWithLayout(
        { type: 'split', dir: 'row', windowId: A },
        { type: 'float' },
        { type: 'split', dir: 'row', windowId: A },
        { type: 'float' },
      ),
    );
    const [low, top] = activeDesktop(harness.state().layout).floats;
    const lowId = low?.paneId ?? '';
    const state = harness.state();
    const lowered = {
      ...state,
      layout: {
        ...state.layout,
        desktops: [{ ...activeDesktop(state.layout), focusedPaneId: lowId }],
      },
    };

    const raised = layoutHarness(lowered);
    const outcome = await command.run('', raised.context());

    const ids = activeDesktop(raised.state().layout).floats.map((float) => float.paneId);

    expect(outcome).toStrictEqual({ ok: true });
    expect(ids).toStrictEqual([top?.paneId, lowId]);
  });

  it('does nothing, quietly, for a tiled pane', async () => {
    const harness = layoutHarness(appWithLayout());
    const before = harness.state();

    await expect(command.run('', harness.context())).resolves.toStrictEqual({ ok: true });

    expect(harness.state()).toBe(before);
  });

  it('refuses an empty desktop', async () => {
    const harness = layoutHarness(appWithLayout({ type: 'closePane' }));

    await expect(command.run('', harness.context())).resolves.toStrictEqual({
      ok: false,
      message: 'There is no pane to raise on this desktop',
    });
  });
});
