/**
 * Tests for `/float move` and `/float size`: percentages of the viewport move
 * and resize the focused float, the rectangle is clamped inside the viewport,
 * and bad numbers or a focus that is not a float are refused.
 */
import { describe, expect, it } from 'vitest';

import { command } from './float';
import { A } from '../../state/layoutSyncFixtures';
import { appWithLayout, layoutHarness } from '../../test/layoutCommand';
import { activeDesktop } from '../../windows/desktops';
import { DEFAULT_FLOAT_RECT, MIN_FLOAT_SIZE } from '../../windows/floats';
import type { FloatRect } from '../../windows/floats';

/** Two panes with the focused one torn off into a float at the default rectangle. */
function withFloat(): ReturnType<typeof layoutHarness> {
  return layoutHarness(
    appWithLayout({ type: 'split', dir: 'row', windowId: A }, { type: 'float' }),
  );
}

/** The rectangle of the one float of {@link harness}. */
function rectOf(harness: ReturnType<typeof layoutHarness>): FloatRect {
  const [float] = activeDesktop(harness.state().layout).floats;
  if (float === undefined) {
    throw new Error('expected a float');
  }
  return float.rect;
}

describe('/float move', () => {
  it('moves the float by percent of the viewport', async () => {
    const harness = withFloat();

    const outcome = await command.run('move 10 -5', harness.context());

    expect(outcome).toStrictEqual({ ok: true });
    expect(rectOf(harness).x).toBeCloseTo(DEFAULT_FLOAT_RECT.x + 0.1);
    expect(rectOf(harness).y).toBeCloseTo(DEFAULT_FLOAT_RECT.y - 0.05);
    expect(rectOf(harness).w).toBe(DEFAULT_FLOAT_RECT.w);
  });

  it('keeps the float inside the viewport', async () => {
    const harness = withFloat();

    await command.run('move 500 500', harness.context());

    expect(rectOf(harness).x).toBeCloseTo(1 - DEFAULT_FLOAT_RECT.w);
    expect(rectOf(harness).y).toBeCloseTo(1 - DEFAULT_FLOAT_RECT.h);

    await command.run('MOVE -500 -500', harness.context());

    expect(rectOf(harness)).toMatchObject({ x: 0, y: 0 });
  });

  it('takes decimals and an explicit plus sign', async () => {
    const harness = withFloat();

    await command.run('move +2.5 0', harness.context());

    expect(rectOf(harness).x).toBeCloseTo(DEFAULT_FLOAT_RECT.x + 0.025);
  });
});

describe('/float size', () => {
  it('grows and shrinks the float by percent of the viewport', async () => {
    const harness = withFloat();

    await command.run('size 10 -10', harness.context());

    expect(rectOf(harness).w).toBeCloseTo(DEFAULT_FLOAT_RECT.w + 0.1);
    expect(rectOf(harness).h).toBeCloseTo(DEFAULT_FLOAT_RECT.h - 0.1);
  });

  it('clamps the size between the minimum and the viewport', async () => {
    const harness = withFloat();

    await command.run('size -500 -500', harness.context());

    expect(rectOf(harness)).toMatchObject({ w: MIN_FLOAT_SIZE, h: MIN_FLOAT_SIZE });

    await command.run('size 500 500', harness.context());

    expect(rectOf(harness)).toMatchObject({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe('/float move and size refusals', () => {
  it.each(['move', 'move 5', 'move a b', 'size 1 2 3', 'size 5% 5'])(
    'echoes the grammar for "%s"',
    async (args) => {
      const harness = withFloat();

      await expect(command.run(args, harness.context())).resolves.toStrictEqual({
        ok: false,
        message: 'Usage: /float move <dx> <dy> | size <dw> <dh>',
      });
    },
  );

  it('refuses when the focused pane is tiled', async () => {
    const harness = layoutHarness(appWithLayout());

    await expect(command.run('move 5 5', harness.context())).resolves.toStrictEqual({
      ok: false,
      message: 'The focused pane is not a float',
    });
    await expect(command.run('size 5 5', harness.context())).resolves.toStrictEqual({
      ok: false,
      message: 'The focused pane is not a float',
    });
  });

  it('refuses on an empty desktop', async () => {
    const harness = layoutHarness(appWithLayout({ type: 'closePane' }));

    await expect(command.run('move 5 5', harness.context())).resolves.toStrictEqual({
      ok: false,
      message: 'The focused pane is not a float',
    });
  });
});
