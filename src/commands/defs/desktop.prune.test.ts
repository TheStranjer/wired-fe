/**
 * Tests for closing desktops by `/desktop` (WFE-273): the `Ctrl+B &` binding,
 * the line saying where a closed desktop's windows went, and `/desktop prune`.
 */
import { describe, expect, it } from 'vitest';

import { command } from './desktop';
import { type DesktopSession, desktopSession } from '../../test/desktopSession';

/** Which desktop (1-based) is shown and how many exist. */
function where(session: DesktopSession): { readonly shown: number; readonly count: number } {
  const { active, desktops } = session.state().layout;
  return { shown: active + 1, count: desktops.length };
}

describe('/desktop close and prune', () => {
  it('names prune in its usage', () => {
    expect(command.usage).toContain('/desktop prune');
  });

  it('binds Ctrl+B & to /desktop close in both modes', () => {
    const chords = command.bindings?.filter((binding) => binding.chord === 'Ctrl+b &');

    expect(chords?.map((binding) => [binding.mode, binding.args])).toStrictEqual([
      ['insert', 'close'],
      ['navigation', 'close'],
    ]);
  });

  it('prints where the windows of a closed desktop went', async () => {
    const session = desktopSession();
    await session.run(command, '3');

    await session.run(command, 'close 1');

    expect(session.printed).toStrictEqual(['closed desktop 1 (its windows are still open: /win)']);
  });

  it('prunes the empty desktops but the active one and says how many', async () => {
    const session = desktopSession();
    await session.run(command, '4');
    await session.run(command, '2');

    const outcome = await session.run(command, 'prune');

    expect(outcome).toStrictEqual({ ok: true });
    expect(session.printed).toStrictEqual(['closed 2 empty desktops']);
    expect(where(session)).toStrictEqual({ shown: 2, count: 2 });
  });

  it('says desktop in the singular when it prunes one', async () => {
    const session = desktopSession();
    await session.run(command, '2');
    await session.run(command, '1');

    await session.run(command, 'prune');

    expect(session.printed).toStrictEqual(['closed 1 empty desktop']);
    expect(where(session)).toStrictEqual({ shown: 1, count: 1 });
  });

  it('says so when there is no empty desktop to prune', async () => {
    const session = desktopSession();

    await expect(session.run(command, 'prune')).resolves.toStrictEqual({ ok: true });

    expect(session.printed).toStrictEqual(['no empty desktops']);
    expect(where(session)).toStrictEqual({ shown: 1, count: 1 });
  });
});
