/**
 * Tests for /mvd against the real app reducer: the focused pane moves to
 * another desktop (made when missing), focus stays on the next pane of the
 * current one, and `follow` switches too.
 */
import { describe, expect, it } from 'vitest';

import { command as desktop } from './desktop';
import { command } from './mvd';
import { type DesktopSession, desktopSession } from '../../test/desktopSession';
import { shownPanes } from '../../windows/desktopPanes';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** The home view the fixture opens. */
const HOME_ID = 'home:lain@wired.example:-';

/** Desktop 1 with `home` and `status` side by side, `status` focused and active. */
function twoPanes(): DesktopSession {
  const session = desktopSession();
  session.apply({
    type: 'windows',
    action: {
      type: 'open',
      ref: { kind: 'home', accountKey: 'lain@wired.example', target: null },
      title: 'home',
    },
  });
  session.apply({
    type: 'layout',
    action: { type: 'split', dir: 'row', windowId: STATUS_WINDOW_ID },
  });
  return session;
}

/** The ids of the windows desktop {@link n} (1-based) shows. */
function windowsOn(session: DesktopSession, n: number): readonly string[] {
  const shown = session.state().layout.desktops[n - 1];
  return shown === undefined ? [] : shownPanes(shown).map((pane) => pane.windowId);
}

describe('/mvd', () => {
  it('declares its name and usage, and has no alias', () => {
    expect(command.name).toBe('mvd');
    expect(command.aliases).toBeUndefined();
    expect(command.usage).toBe('/mvd <number> [follow]');
  });

  it('moves the focused pane to a new desktop and stays on the next pane here', async () => {
    const session = twoPanes();

    const outcome = await session.run(command, '2');

    expect(outcome).toStrictEqual({ ok: true });
    expect(session.state().layout.active).toBe(0);
    expect(windowsOn(session, 1)).toStrictEqual([HOME_ID]);
    expect(windowsOn(session, 2)).toStrictEqual([STATUS_WINDOW_ID]);
    expect(session.state().windows.activeId).toBe(HOME_ID);
  });

  it('creates every desktop up to the target', async () => {
    const session = twoPanes();

    await session.run(command, '4');

    expect(session.state().layout.desktops).toHaveLength(4);
    expect(windowsOn(session, 4)).toStrictEqual([STATUS_WINDOW_ID]);
    expect(windowsOn(session, 2)).toStrictEqual([]);
  });

  it('moves to an existing desktop beside what is there', async () => {
    const session = twoPanes();
    await session.run(command, '2');
    await session.run(desktop, '2');
    await session.run(desktop, 'new');
    await session.run(desktop, '1');

    await session.run(command, '2');

    expect(windowsOn(session, 1)).toStrictEqual([]);
    expect(windowsOn(session, 2)).toStrictEqual([STATUS_WINDOW_ID, HOME_ID]);
  });

  it('follows to the target desktop with follow', async () => {
    const session = twoPanes();

    const outcome = await session.run(command, '3 follow');

    expect(outcome).toStrictEqual({ ok: true });
    expect(session.state().layout.active).toBe(2);
    expect(windowsOn(session, 3)).toStrictEqual([STATUS_WINDOW_ID]);
    expect(windowsOn(session, 1)).toStrictEqual([HOME_ID]);
    expect(session.state().windows.activeId).toBe(STATUS_WINDOW_ID);
  });

  it('moves a float too', async () => {
    const session = twoPanes();
    session.apply({ type: 'layout', action: { type: 'float' } });

    await session.run(command, '2 follow');

    expect(session.state().layout.desktops[1]?.floats).toHaveLength(1);
    expect(session.state().layout.desktops[0]?.floats).toHaveLength(0);
  });

  it('refuses a desktop that is already showing', async () => {
    const session = twoPanes();

    await expect(session.run(command, '1')).resolves.toStrictEqual({
      ok: false,
      message: 'Already on desktop 1',
    });

    expect(windowsOn(session, 1)).toStrictEqual([HOME_ID, STATUS_WINDOW_ID]);
  });

  it('refuses on an empty desktop', async () => {
    const session = twoPanes();
    await session.run(desktop, '2');

    await expect(session.run(command, '1')).resolves.toStrictEqual({
      ok: false,
      message: 'No pane to move',
    });
  });

  it('refuses a bad desktop number, a bad second word and extra words', async () => {
    const session = twoPanes();
    const usage = { ok: false, message: 'Usage: /mvd <number> [follow]' };

    await expect(session.run(command, '')).resolves.toStrictEqual(usage);
    await expect(session.run(command, '0')).resolves.toStrictEqual(usage);
    await expect(session.run(command, '2 later')).resolves.toStrictEqual(usage);
    await expect(session.run(command, '2 follow now')).resolves.toStrictEqual(usage);

    expect(session.state().layout.desktops).toHaveLength(1);
  });

  it('refuses a desktop number past the limit', async () => {
    const session = twoPanes();

    await expect(session.run(command, '99999999')).resolves.toStrictEqual({
      ok: false,
      message: 'Desktops go up to 1000',
    });

    expect(session.state().layout.desktops).toHaveLength(1);
  });
});
