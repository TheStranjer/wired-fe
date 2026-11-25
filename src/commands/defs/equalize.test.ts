/**
 * Tests for /equalize: it asks the layout reducer to equalize the active
 * desktop's tree and ignores its arguments.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './equalize';
import { fakeCommandContext } from '../../test/commandContext';

describe('/equalize', () => {
  it('dispatches an equalize layout action and succeeds', async () => {
    const dispatch = vi.fn();

    const outcome = await command.run('now', fakeCommandContext({ dispatch }));

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: 'layout',
      action: { type: 'equalize' },
    });
  });
});
