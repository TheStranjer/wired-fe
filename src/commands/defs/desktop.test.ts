/**
 * Tests for /desktop against the real app reducer: listing, switching with
 * creation beyond the last, stepping with wrap-around, making new desktops and
 * closing them, with panes and with the last one.
 */
import { describe, expect, it } from 'vitest';

import { command } from './desktop';
import { type DesktopSession, desktopSession } from '../../test/desktopSession';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** The home view the fixture opens. */
const HOME_ID = 'home:lain@wired.example:-';

/** Desktop 1 with `home` and `status` side by side, `status` focused; windows 1 and 2 open. */
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

/** Which desktop (1-based) is shown and how many exist. */
function where(session: DesktopSession): { readonly shown: number; readonly count: number } {
  const { active, desktops } = session.state().layout;
  return { shown: active + 1, count: desktops.length };
}

/** The failure a command answers with. */
function refusal(message: string): { readonly ok: false; readonly message: string } {
  return { ok: false, message };
}

describe('/desktop', () => {
  it('declares its name, alias and usage', () => {
    expect(command.name).toBe('desktop');
    expect(command.aliases).toStrictEqual(['d']);
    expect(command.usage).toContain('/desktop close [number]');
  });

  it('lists number, pane count and windows, with a star on the active one', async () => {
    const session = twoPanes();
    await session.run(command, '3');
    session.apply({ type: 'layout', action: { type: 'goToDesktop', n: 1 } });

    const outcome = await session.run(command, '');

    expect(outcome).toStrictEqual({ ok: true });
    expect(session.printed).toStrictEqual([
      '* 1: 2 panes: home, status',
      '  2: 0 panes',
      '  3: 0 panes',
    ]);
  });

  it('says pane in the singular for a desktop with one', async () => {
    const session = desktopSession();

    await session.run(command, '');

    expect(session.printed).toStrictEqual(['* 1: 1 pane: status']);
  });

  it('lists each window once, counts floats, and names a window the list lost by its id', async () => {
    const session = twoPanes();
    session.apply({ type: 'layout', action: { type: 'split', dir: 'column', windowId: 'ghost' } });
    session.apply({ type: 'layout', action: { type: 'split', dir: 'row', windowId: HOME_ID } });
    session.apply({ type: 'layout', action: { type: 'float' } });

    await session.run(command, 'list');

    expect(session.printed).toStrictEqual(['* 1: 4 panes: home, status, ghost']);
  });

  it('shows desktop N, creating the missing ones up to it', async () => {
    const session = twoPanes();

    await expect(session.run(command, '4')).resolves.toStrictEqual({ ok: true });

    expect(where(session)).toStrictEqual({ shown: 4, count: 4 });
  });

  it('goes back to an existing desktop without creating one', async () => {
    const session = twoPanes();
    await session.run(command, '3');
    await session.run(command, '1');

    expect(where(session)).toStrictEqual({ shown: 1, count: 3 });
  });

  it('refuses what is not a desktop number', async () => {
    const session = twoPanes();
    const usage = refusal(`Usage: ${command.usage}`);

    await expect(session.run(command, '0')).resolves.toStrictEqual(usage);
    await expect(session.run(command, 'two')).resolves.toStrictEqual(usage);
    await expect(session.run(command, '-1')).resolves.toStrictEqual(usage);

    expect(where(session)).toStrictEqual({ shown: 1, count: 1 });
  });

  it('refuses a number no one means to build that many desktops for', async () => {
    const session = twoPanes();

    await expect(session.run(command, '99999999')).resolves.toStrictEqual(
      refusal('Desktops go up to 1000'),
    );

    expect(where(session)).toStrictEqual({ shown: 1, count: 1 });
  });

  it('steps right with next, and past the last creates a desktop', async () => {
    const session = twoPanes();
    await session.run(command, '2');
    await session.run(command, '1');

    await session.run(command, 'next');
    const second = where(session);
    await session.run(command, 'next');

    expect(second).toStrictEqual({ shown: 2, count: 2 });
    expect(where(session)).toStrictEqual({ shown: 3, count: 3 });
  });

  it('steps left with prev, and left of the first wraps to the last', async () => {
    const session = twoPanes();
    await session.run(command, '3');

    await session.run(command, 'prev');
    const second = where(session);
    await session.run(command, '1');
    await session.run(command, 'previous');

    expect(second.shown).toBe(2);
    expect(where(session)).toStrictEqual({ shown: 3, count: 3 });
  });

  it('makes a new desktop after the last and shows it', async () => {
    const session = twoPanes();
    await session.run(command, '2');
    await session.run(command, '1');

    await session.run(command, 'new');

    expect(where(session)).toStrictEqual({ shown: 3, count: 3 });
  });

  it('closes the active desktop without a number; its panes go, its windows stay open', async () => {
    const session = twoPanes();
    await session.run(command, '2');
    await session.run(command, '1');

    const outcome = await session.run(command, 'close');

    expect(outcome).toStrictEqual({ ok: true });
    expect(where(session)).toStrictEqual({ shown: 1, count: 1 });
    expect(session.state().windows.windows.map((win) => win.id)).toStrictEqual([
      STATUS_WINDOW_ID,
      HOME_ID,
    ]);
    expect(session.state().layout.desktops[0]?.tree).toBeNull();
  });

  it('closes desktop N and keeps looking at the one that was shown', async () => {
    const session = twoPanes();
    await session.run(command, '3');

    await session.run(command, 'close 1');

    expect(where(session)).toStrictEqual({ shown: 2, count: 2 });
  });

  it('refuses to close the last desktop', async () => {
    const session = twoPanes();
    const last = refusal("Can't close the last desktop");

    await expect(session.run(command, 'close')).resolves.toStrictEqual(last);
    await expect(session.run(command, 'close 1')).resolves.toStrictEqual(last);

    expect(where(session)).toStrictEqual({ shown: 1, count: 1 });
  });

  it('refuses to close a desktop that does not exist or a bad number', async () => {
    const session = twoPanes();
    await session.run(command, '2');

    await expect(session.run(command, 'close 5')).resolves.toStrictEqual(refusal('No desktop 5'));
    await expect(session.run(command, 'close x')).resolves.toStrictEqual(
      refusal(`Usage: ${command.usage}`),
    );

    expect(where(session)).toStrictEqual({ shown: 2, count: 2 });
  });
});
