/**
 * Tests for /swap: every direction word and its vim letter, any case, and a
 * bad word, `next`, or a missing word echoing the usage with nothing dispatched.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './swap';
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

describe('/swap', () => {
  it.each([
    ['left', 'left'],
    ['h', 'left'],
    ['right', 'right'],
    ['l', 'right'],
    ['up', 'up'],
    ['k', 'up'],
    ['down', 'down'],
    ['j', 'down'],
    [' Down ', 'down'],
  ] as const)('%s dispatches a swap %s', async (args, direction) => {
    const { context, dispatch } = stub();

    const outcome = await command.run(args, context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: 'layout',
      action: { type: 'swap', direction },
    });
  });

  it.each(['', 'next', 'left right', 'diagonal'])(
    'echoes the usage for %j and dispatches nothing',
    async (args) => {
      const { context, dispatch } = stub();

      const outcome = await command.run(args, context);

      expect(outcome).toStrictEqual({ ok: false, message: 'Usage: /swap <left|right|up|down>' });
      expect(dispatch).not.toHaveBeenCalled();
    },
  );
});
