/**
 * Tests for /focus: every direction word and its vim letter, `next` and
 * `prev`, any case, and a bad or missing word echoing the usage with nothing
 * dispatched.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './focus';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

/** A context whose dispatch is a mock to assert on. */
function stub(): {
  readonly context: CommandContext;
  readonly dispatch: Mock<CommandContext['dispatch']>;
} {
  const dispatch: Mock<CommandContext['dispatch']> = vi.fn();
  return { context: fakeCommandContext({ dispatch }), dispatch };
}

describe('/focus', () => {
  it.each([
    ['left', 'left'],
    ['h', 'left'],
    ['right', 'right'],
    ['l', 'right'],
    ['up', 'up'],
    ['k', 'up'],
    ['down', 'down'],
    ['j', 'down'],
    ['next', 'next'],
    ['prev', 'prev'],
    ['  LEFT ', 'left'],
  ] as const)('%s dispatches a %s step', async (args, step) => {
    const { context, dispatch } = stub();

    const outcome = await command.run(args, context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: 'layout',
      action: { type: 'focusStep', step },
    });
  });

  it.each(['', 'sideways', 'left right', 'previous'])(
    'echoes the usage for %j and dispatches nothing',
    async (args) => {
      const { context, dispatch } = stub();

      const outcome = await command.run(args, context);

      expect(outcome).toStrictEqual({
        ok: false,
        message: 'Usage: /focus <left|right|up|down|next|prev>',
      });
      expect(dispatch).not.toHaveBeenCalled();
    },
  );
});
