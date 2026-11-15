/**
 * Tests for /select: every argument word dispatches the buffer action it
 * names on the active window, and a label is resolved through that window's
 * own buffer — its post line, or the notification line holding the post —
 * while an unknown label and anything but one word refuse without
 * dispatching anything.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './select';
import type { StoredAccount } from '../../accounts/accountStore';
import { type AppState, initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { notification, status } from '../../test/fixtures';
import { type WindowRef, windowId } from '../../windows/model';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The signed-in account whose home window is the active one. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};

const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };
const HOME_ID = windowId(HOME);

/** The window's posts, labelled oldest first: a0, a1, then a2 on the mention. */
const ALPHA = status('a');
const BRAVO = status('b');
const MENTIONED = status('m1');

/** The state under test: lain's open home window showing all three posts. */
function homeState(): AppState {
  const signed = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const posted = appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: [BRAVO, ALPHA],
    where: 'newer',
  });
  return appReducer(posted, {
    type: 'notifications',
    windowId: HOME_ID,
    notifications: [notification('n1', MENTIONED)],
    where: 'newer',
  });
}

/** The command over {@link homeState} with the reducer recording its actions. */
function stubbed(): {
  readonly context: CommandContext;
  readonly dispatch: Mock<CommandContext['dispatch']>;
  readonly print: Mock<CommandContext['print']>;
} {
  const dispatch: Mock<CommandContext['dispatch']> = vi.fn();
  const print: Mock<CommandContext['print']> = vi.fn();
  const state = homeState();
  return {
    context: fakeCommandContext({ state, windows: state.windows, dispatch, print }),
    dispatch,
    print,
  };
}

describe('/select', () => {
  it('steps forward with next', async () => {
    const { context, dispatch } = stubbed();

    const outcome = await command.run('next', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'selectRelative', windowId: HOME_ID, delta: 1 });
  });

  it('steps backward with prev', async () => {
    const { context, dispatch } = stubbed();

    const outcome = await command.run('prev', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'selectRelative', windowId: HOME_ID, delta: -1 });
  });

  it('jumps to the oldest line with first', async () => {
    const { context, dispatch } = stubbed();

    const outcome = await command.run('first', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'selectEdge', windowId: HOME_ID, edge: 'first' });
  });

  it('jumps to the newest line with last', async () => {
    const { context, dispatch } = stubbed();

    const outcome = await command.run('last', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'selectEdge', windowId: HOME_ID, edge: 'last' });
  });

  it('drops the selection with none', async () => {
    const { context, dispatch } = stubbed();

    const outcome = await command.run('none', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'select', windowId: HOME_ID, key: null });
  });

  it('selects the post line a label names', async () => {
    const { context, dispatch } = stubbed();

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'select', windowId: HOME_ID, key: 'post:a' });
  });

  it('reads a label in any case', async () => {
    const { context, dispatch } = stubbed();

    const outcome = await command.run('A1', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'select', windowId: HOME_ID, key: 'post:b' });
  });

  it('selects the notification line holding the labelled post', async () => {
    const { context, dispatch } = stubbed();

    const outcome = await command.run('a2', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'select', windowId: HOME_ID, key: 'notif:n1' });
  });

  it('refuses a label this window never gave', async () => {
    const { context, dispatch } = stubbed();

    const outcome = await command.run('z9', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'No post z9 here' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('reports the usage for no arguments', async () => {
    const { context, dispatch } = stubbed();
    const usage = { ok: false, message: `Usage: ${command.usage}` };

    const empty = await command.run('', context);
    const spaces = await command.run('   ', context);

    expect(empty).toStrictEqual(usage);
    expect(spaces).toStrictEqual(usage);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('reports the usage for more than one word', async () => {
    const { context, dispatch } = stubbed();

    const outcome = await command.run('a0 now', context);

    expect(outcome).toStrictEqual({ ok: false, message: `Usage: ${command.usage}` });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('prints nothing itself: failures are the dispatcher to report', async () => {
    const { context, print } = stubbed();

    const outcome = await command.run('z9', context);

    expect(outcome.ok).toBe(false);
    expect(print).not.toHaveBeenCalled();
  });

  it('declares the documented navigation keys', () => {
    expect(command.name).toBe('select');
    expect(command.aliases).toStrictEqual(['sel']);
    expect(command.bindings?.map((binding) => `${binding.chord}=${binding.args}`)).toStrictEqual([
      'j=next',
      'ArrowDown=next',
      'k=prev',
      'ArrowUp=prev',
      'g=first',
      'Shift+g=last',
      'Home=first',
      'End=last',
      'Escape=none',
    ]);
    expect(command.bindings?.every((binding) => binding.mode === 'navigation')).toBe(true);
  });
});
