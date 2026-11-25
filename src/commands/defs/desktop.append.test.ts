/**
 * Tests for making desktops with /desktop (WFE-272): `next`, `new` and a
 * number past the end make one only past a last desktop with something on it,
 * at most one at a time; otherwise they fail with the reason and dispatch
 * nothing. Moving between existing desktops is never refused.
 */
import { describe, expect, it } from 'vitest';

import { command } from './desktop';
import { type DesktopSession, desktopSession } from '../../test/desktopSession';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** What the command says on an empty last desktop that is also the one shown. */
const ON_IT = 'Desktop 2 is empty: put something on it before making another';

/** What it says on an empty last desktop when another one is shown. */
const ELSEWHERE = 'Desktop 2 is empty: use it before making another';

/** Put the status window on the desktop being shown, so it is no longer empty. */
function fill(session: DesktopSession): void {
  session.apply({
    type: 'layout',
    action: { type: 'split', dir: 'row', windowId: STATUS_WINDOW_ID },
  });
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

/** A session on desktop 2, which is empty and the last one. */
async function onEmptyLast(): Promise<DesktopSession> {
  const session = desktopSession();
  await session.run(command, 'next');
  return session;
}

describe('/desktop making desktops', () => {
  it('makes the desktop just past a last one with something on it', async () => {
    const session = desktopSession();

    await expect(session.run(command, '2')).resolves.toStrictEqual({ ok: true });

    expect(where(session)).toStrictEqual({ shown: 2, count: 2 });
  });

  it('refuses a number further past the end, and changes nothing', async () => {
    const session = desktopSession();
    await session.run(command, '2');
    fill(session);
    await session.run(command, '3');
    const before = session.state();

    await expect(session.run(command, '20')).resolves.toStrictEqual(
      refusal('No desktop 20; desktops run 1–3'),
    );

    expect(session.state()).toBe(before);
  });

  it('refuses the desktop past an empty last one, naming where you are', async () => {
    const session = await onEmptyLast();

    await expect(session.run(command, '3')).resolves.toStrictEqual(refusal(ON_IT));

    await session.run(command, '1');

    await expect(session.run(command, '3')).resolves.toStrictEqual(refusal(ELSEWHERE));
    expect(where(session)).toStrictEqual({ shown: 1, count: 2 });
  });

  it('adds exactly one desktop with next on a last desktop with something on it', async () => {
    const session = desktopSession();

    await expect(session.run(command, 'next')).resolves.toStrictEqual({ ok: true });

    expect(where(session)).toStrictEqual({ shown: 2, count: 2 });
  });

  it('refuses next on an empty last desktop, dispatching nothing', async () => {
    const session = await onEmptyLast();
    const before = session.state();

    await expect(session.run(command, 'next')).resolves.toStrictEqual(refusal(ON_IT));

    expect(session.state()).toBe(before);
  });

  it('steps with next between existing desktops, empty or not', async () => {
    const session = await onEmptyLast();
    await session.run(command, '1');

    await expect(session.run(command, 'next')).resolves.toStrictEqual({ ok: true });

    expect(where(session)).toStrictEqual({ shown: 2, count: 2 });
  });

  it('adds exactly one desktop with new on a last desktop with something on it', async () => {
    const session = desktopSession();

    await expect(session.run(command, 'new')).resolves.toStrictEqual({ ok: true });

    expect(where(session)).toStrictEqual({ shown: 2, count: 2 });
  });

  it('refuses a new desktop while the last one is empty, wherever you are', async () => {
    const session = await onEmptyLast();
    const before = session.state();

    await expect(session.run(command, 'new')).resolves.toStrictEqual(refusal(ON_IT));

    expect(session.state()).toBe(before);

    await session.run(command, '1');
    const away = session.state();

    await expect(session.run(command, 'new')).resolves.toStrictEqual(refusal(ELSEWHERE));
    expect(session.state()).toBe(away);
  });
});
