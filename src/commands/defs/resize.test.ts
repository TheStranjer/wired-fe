/**
 * Tests for /resize: relative and absolute amounts on the `a` and `b` side of
 * a split, clamping, floats, the usage refusals and the nothing-to-resize
 * message. Dispatched layout actions are run through the layout reducer so the
 * tests see the sizes they produce.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './resize';
import { initialAppState } from '../../state/appState';
import { fakeCommandContext } from '../../test/commandContext';
import { activeDesktop, floatFocused, initialDesktops, splitFocused } from '../../windows/desktops';
import type { DesktopsState } from '../../windows/desktops';
import { findFloat } from '../../windows/floats';
import { layoutReducer } from '../../windows/layoutReducer';
import type { SplitTree } from '../../windows/splitTree';
import type { CommandContext, CommandOutcome } from '../types';

/** Two panes side by side, p2 (the `b` side) focused; the split starts at 0.5. */
function sideBySide(): DesktopsState {
  return splitFocused(initialDesktops('w1'), 'row', 'w2');
}

/** What running `/resize <args>` on `layout` did: the outcome and the layout after its actions. */
async function resize(
  args: string,
  layout: DesktopsState,
): Promise<{
  readonly outcome: CommandOutcome;
  readonly after: DesktopsState;
  readonly count: number;
}> {
  let after = layout;
  const dispatch = vi.fn((action: Parameters<CommandContext['dispatch']>[0]) => {
    if (action.type === 'layout') {
      after = layoutReducer(after, action.action);
    }
  });
  const context = fakeCommandContext({ state: { ...initialAppState(), layout }, dispatch });
  const outcome = await command.run(args, context);
  return { outcome, after, count: dispatch.mock.calls.length };
}

/** The ratio of the active desktop's root split. */
function rootRatio(layout: DesktopsState): number {
  const tree: SplitTree | null = activeDesktop(layout).tree;
  if (tree === null || tree.type === 'pane') {
    throw new Error('expected a split');
  }
  return tree.ratio;
}

describe('/resize in the tree', () => {
  it('grows the b side by moving the ratio down', async () => {
    const { outcome, after } = await resize('width +10', sideBySide());

    expect(outcome).toStrictEqual({ ok: true });
    expect(rootRatio(after)).toBeCloseTo(0.4);
  });

  it('shrinks the b side by moving the ratio up', async () => {
    const { after } = await resize('width -10', sideBySide());

    expect(rootRatio(after)).toBeCloseTo(0.6);
  });

  it('grows and shrinks the a side the other way round', async () => {
    const focusedA = {
      ...sideBySide(),
      desktops: [{ ...activeDesktop(sideBySide()), focusedPaneId: 'p1' }],
    };

    expect(rootRatio((await resize('width +10', focusedA)).after)).toBeCloseTo(0.6);
    expect(rootRatio((await resize('width -10', focusedA)).after)).toBeCloseTo(0.4);
  });

  it('sets the share of the b side absolutely', async () => {
    const { after } = await resize('width 30', sideBySide());

    expect(rootRatio(after)).toBeCloseTo(0.7);
  });

  it('sets the share of the a side absolutely', async () => {
    const focusedA = {
      ...sideBySide(),
      desktops: [{ ...activeDesktop(sideBySide()), focusedPaneId: 'p1' }],
    };

    expect(rootRatio((await resize('width 40', focusedA)).after)).toBeCloseTo(0.4);
  });

  it('clamps to the largest and smallest share', async () => {
    expect(rootRatio((await resize('width -90', sideBySide())).after)).toBeCloseTo(0.9);
    expect(rootRatio((await resize('width +90', sideBySide())).after)).toBeCloseTo(0.1);
    expect(rootRatio((await resize('width 100', sideBySide())).after)).toBeCloseTo(0.1);
  });

  it('resizes height along column splits', async () => {
    const stacked = splitFocused(initialDesktops('w1'), 'column', 'w2');

    expect(rootRatio((await resize('height +20', stacked)).after)).toBeCloseTo(0.3);
  });

  it('accepts a fractional amount', async () => {
    expect(rootRatio((await resize('width -2.5', sideBySide())).after)).toBeCloseTo(0.525);
  });
});

describe('/resize on a float', () => {
  /** One pane torn off beside another: p2 is a float with the default rectangle. */
  function floating(): DesktopsState {
    return floatFocused(sideBySide());
  }

  it('changes the width by a share of the viewport', async () => {
    const { outcome, after } = await resize('width +10', floating());

    expect(outcome).toStrictEqual({ ok: true });
    expect(findFloat(activeDesktop(after).floats, 'p2')?.rect.w).toBeCloseTo(0.6);
  });

  it('changes the height by a share of the viewport', async () => {
    const { after } = await resize('height -10', floating());

    expect(findFloat(activeDesktop(after).floats, 'p2')?.rect.h).toBeCloseTo(0.5);
  });

  it('sets an absolute size', async () => {
    const { after } = await resize('width 40', floating());

    expect(findFloat(activeDesktop(after).floats, 'p2')?.rect.w).toBeCloseTo(0.4);
  });
});

describe('/resize with nothing to do', () => {
  it('says so for a lone pane and dispatches nothing', async () => {
    const { outcome, count } = await resize('width +10', initialDesktops('w1'));

    expect(outcome).toStrictEqual({ ok: false, message: 'Nothing to resize' });
    expect(count).toBe(0);
  });

  it('says so when the split runs the other way', async () => {
    const { outcome } = await resize('height +10', sideBySide());

    expect(outcome).toStrictEqual({ ok: false, message: 'Nothing to resize' });
  });

  it('says so when the focus points at no pane', async () => {
    const lone = floatFocused(initialDesktops('w1'));
    const { outcome } = await resize('width +10', {
      ...lone,
      desktops: [{ ...activeDesktop(lone), focusedPaneId: 'p9' }],
    });

    expect(outcome).toStrictEqual({ ok: false, message: 'Nothing to resize' });
  });

  it('says so on a desktop with no focus', async () => {
    const empty = { ...sideBySide(), desktops: [{ tree: null, floats: [], focusedPaneId: null }] };

    const { outcome } = await resize('width +10', empty);

    expect(outcome).toStrictEqual({ ok: false, message: 'Nothing to resize' });
  });

  it('says so on a desktop with a focus but no tree', async () => {
    const empty = { ...sideBySide(), desktops: [{ tree: null, floats: [], focusedPaneId: 'p1' }] };

    const { outcome } = await resize('width +10', empty);

    expect(outcome).toStrictEqual({ ok: false, message: 'Nothing to resize' });
  });
});

describe('/resize usage', () => {
  it.each(['', 'width', 'depth +5', 'width ten', 'width +5 extra', '+5 width', 'constructor 5'])(
    'refuses "%s" with the usage',
    async (args) => {
      const { outcome, count } = await resize(args, sideBySide());

      expect(outcome).toStrictEqual({ ok: false, message: 'Usage: /resize width|height +N|-N|N' });
      expect(count).toBe(0);
    },
  );
});
