/**
 * Tests for the placement every open command shares (decision 13): the
 * trailing `--in <placement>` is cut off the arguments (and refused when it
 * names nothing real), and the windows the wrapped run opens are placed by
 * `--in`, else the kind's setting, else the default — `here` being the plain
 * open, which is also what a caller that places the window itself gets.
 */
import { describe, expect, it } from 'vitest';

import { placedRun, splitPlacement } from './openWindowRun';
import { OK } from './outcome';
import type { CommandContext, CommandDefinition } from './types';
import { initialAppState } from '../state/appState';
import { DEFAULT_SETTINGS, type Settings } from '../state/settings';
import { fakeCommandContext } from '../test/commandContext';
import type { WindowsAction } from '../windows/reducer';

/** The ask the wrapped run makes: a thread window. */
const THREAD: Extract<WindowsAction, { readonly type: 'open' }> = {
  type: 'open',
  ref: { kind: 'thread', accountKey: 'a#1', target: '42' },
  title: 'thread/42',
};

/** A run that opens {@link THREAD}, then a non-open action, recording the arguments it was given. */
function opening(): {
  readonly run: CommandDefinition['run'];
  readonly seen: string[];
} {
  const seen: string[] = [];
  const run: CommandDefinition['run'] = async (args, context) => {
    seen.push(args);
    context.dispatchWindows(THREAD);
    context.dispatchWindows({ type: 'activate', id: 'status' });
    return await Promise.resolve(OK);
  };
  return { run, seen };
}

/** A context over a session with {@link settings}. */
function contextWith(settings: Settings, extra: Partial<CommandContext> = {}): CommandContext {
  return fakeCommandContext({ state: initialAppState(settings), ...extra });
}

describe(splitPlacement, () => {
  it.each([
    ['rust', 'rust', null],
    ['', '', null],
    ['rust --in float', 'rust', 'float'],
    ['rust   --in   vsplit  ', 'rust', 'vsplit'],
    ['--in hidden', '', 'hidden'],
    ['two words --in split', 'two words', 'split'],
    ['rust --in FLOAT', 'rust', 'float'],
    ['rust --in here', 'rust', 'here'],
  ])('reads %j as %j placed %j', (args, rest, placement) => {
    expect(splitPlacement(args)).toStrictEqual({ ok: true, value: { rest, placement } });
  });

  it.each([['a--in float'], ['rust --in float extra'], ['--inside']])(
    'leaves %j alone: it does not end in a --in',
    (args) => {
      expect(splitPlacement(args)).toStrictEqual({
        ok: true,
        value: { rest: args, placement: null },
      });
    },
  );

  it.each([['rust --in'], ['--in'], ['rust --in sideways']])(
    'refuses %j, listing the words',
    (args) => {
      expect(splitPlacement(args)).toStrictEqual({
        ok: false,
        error: '--in takes here|vsplit|split|float|hidden',
      });
    },
  );
});

describe(placedRun, () => {
  it('opens in place by default, handing the run its arguments without the flag', async () => {
    const { run, seen } = opening();
    const context = contextWith(DEFAULT_SETTINGS);

    await placedRun(run)('42 --in here', context);

    expect(seen).toStrictEqual(['42']);
    expect(context.dispatchWindows).toHaveBeenCalledWith(THREAD);
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('places the window by the default setting', async () => {
    const context = contextWith({ ...DEFAULT_SETTINGS, openIn: 'float' });

    await placedRun(opening().run)('', context);

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'openPlaced',
      action: THREAD,
      placement: 'float',
    });
    expect(context.dispatchWindows).toHaveBeenCalledTimes(1);
    expect(context.dispatchWindows).toHaveBeenCalledWith({ type: 'activate', id: 'status' });
  });

  it('places a window of that kind by its own setting over the default', async () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      openIn: 'float',
      openInByKind: { thread: 'vsplit' },
    };
    const context = contextWith(settings);

    await placedRun(opening().run)('', context);

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'openPlaced',
      action: THREAD,
      placement: 'vsplit',
    });
  });

  it('places the window by --in over both settings', async () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      openIn: 'float',
      openInByKind: { thread: 'vsplit' },
    };
    const context = contextWith(settings);

    await placedRun(opening().run)('--in hidden', context);

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'openPlaced',
      action: THREAD,
      placement: 'hidden',
    });
  });

  it('lets --in here override settings that place elsewhere', async () => {
    const context = contextWith({ ...DEFAULT_SETTINGS, openIn: 'float' });

    await placedRun(opening().run)('--in here', context);

    expect(context.dispatchWindows).toHaveBeenCalledWith(THREAD);
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('refuses a bad --in without running the command', async () => {
    const { run, seen } = opening();
    const context = contextWith(DEFAULT_SETTINGS);

    const outcome = await placedRun(run)('--in sideways', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: '--in takes here|vsplit|split|float|hidden',
    });
    expect(seen).toStrictEqual([]);
    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('leaves the placing to a caller that places the window itself', async () => {
    const context = contextWith({ ...DEFAULT_SETTINGS, openIn: 'float' }, { placedByCaller: true });

    const outcome = await placedRun(opening().run)('--in split', context);

    expect(outcome).toStrictEqual(OK);
    expect(context.dispatchWindows).toHaveBeenCalledWith(THREAD);
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
