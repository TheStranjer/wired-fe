/**
 * Tests for /unblock: the definition the command line, /help and completion
 * read, and a block taken back from the author of a label's post — printed
 * `unblocked @x`. The shared body and every refusal live in
 * ../accountToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './unblock';
import { status } from '../../test/fixtures';
import { FOREIGN_WIRE, homeContext, serveAccountActions } from '../../test/homeWindow';

/** A post by smiling: its author is the account the unblock acts on. */
const FOREIGN = status('q', { account: FOREIGN_WIRE });

describe('/unblock', () => {
  it('declares its name, grammar and summary', () => {
    expect(command.name).toBe('unblock');
    expect(command.usage).toBe('/unblock [target]');
    expect(command.summary).toBe('Take a block back');
    expect(command.bindings).toBeUndefined();
  });

  it('unblocks the author of the post a label names', async () => {
    const calls = serveAccountActions({ id: '2' });
    const context = homeContext([FOREIGN]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/unblock', body: undefined }]);
    expect(context.print).toHaveBeenCalledWith('unblocked @smiling@wired.example');
  });
});
