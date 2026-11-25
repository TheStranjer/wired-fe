/**
 * Tests for running command lines in a row (decision 6): each line runs
 * through the registry as the command line would, the lines after one see what
 * it changed, the first refusal stops the rest, and text, an unknown command
 * and a command that throws are refusals too.
 */
import { describe, expect, it } from 'vitest';

import { command as feed } from './defs/feed';
import { OK } from './outcome';
import { buildRegistry } from './registry';
import { runLines } from './runLines';
import type { CommandDefinition } from './types';
import { initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { fakeCommandContext } from '../test/commandContext';
import { ALICE, LAIN } from '../test/splitDesk';

/** A command that throws {@link thrown} when it runs. */
function thrower(name: string, thrown: unknown): CommandDefinition {
  return {
    name,
    usage: `/${name}`,
    summary: 'throws',
    run: async () => {
      await Promise.resolve();
      throw thrown;
    },
  };
}

/** A running session over the real reducer, with `/feed` and two throwing commands registered. */
function session(): {
  readonly state: () => ReturnType<typeof initialAppState>;
  readonly run: (...lines: string[]) => ReturnType<typeof runLines>;
} {
  const registry = buildRegistry([feed, thrower('boom', new Error('kaput')), thrower('odd', 7)]);
  if (!registry.ok) {
    throw new Error(registry.error);
  }
  let state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN, ALICE],
    activeKey: ALICE.key,
  });
  const dispatch = (action: AppAction): void => {
    state = appReducer(state, action);
  };
  return {
    state: () => state,
    run: async (...lines) =>
      await runLines(
        lines,
        fakeCommandContext({
          state,
          windows: state.windows,
          dispatch,
          registry: registry.value,
        }),
      ),
  };
}

describe(runLines, () => {
  it('runs the lines in order, each one seeing what the ones before it changed', async () => {
    const desk = session();

    const outcome = await desk.run(
      '/feed new main *:home',
      '/feed add main lain@wired.example:dms',
    );

    expect(outcome).toStrictEqual(OK);
    expect(desk.state().settings.feeds).toStrictEqual([
      {
        id: 'f1',
        name: 'main',
        sources: [
          { accountKey: LAIN.key, source: 'home' },
          { accountKey: ALICE.key, source: 'home' },
          { accountKey: LAIN.key, source: 'dms' },
        ],
      },
    ]);
  });

  it('succeeds with no lines at all', async () => {
    await expect(session().run()).resolves.toStrictEqual(OK);
  });

  it('stops at the first refusal and leaves the lines after it unrun', async () => {
    const desk = session();

    const outcome = await desk.run(
      '/feed new main *:home',
      '/feed add nope *:local',
      '/feed new x',
    );

    expect(outcome).toStrictEqual({ ok: false, message: 'No feed named "nope"' });
    expect(desk.state().settings.feeds.map((one) => one.name)).toStrictEqual(['main']);
  });

  it('refuses plain text and a command nobody registered', async () => {
    const desk = session();

    await expect(desk.run('hello')).resolves.toStrictEqual({
      ok: false,
      message: 'Not a command: hello',
    });
    await expect(desk.run('/nothing')).resolves.toStrictEqual({
      ok: false,
      message: 'Unknown command: /nothing',
    });
  });

  it('refuses a command that throws, saying why, whatever was thrown', async () => {
    const desk = session();

    await expect(desk.run('/boom')).resolves.toStrictEqual({
      ok: false,
      message: 'Command failed: kaput',
    });
    await expect(desk.run('/odd')).resolves.toStrictEqual({
      ok: false,
      message: 'Command failed: 7',
    });
  });
});
