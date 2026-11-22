/**
 * Tests for /unfollow: the definition the command line, /help and completion
 * read, and a follow taken back from the author of a label's post — printed
 * `unfollowed @x`. The shared body and every refusal live in
 * ../accountToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './unfollow';
import { status } from '../../test/fixtures';
import { FOREIGN_WIRE, homeContext, serveAccountActions } from '../../test/homeWindow';

/** A post by smiling: its author is the account the unfollow acts on. */
const FOREIGN = status('q', { account: FOREIGN_WIRE });

describe('/unfollow', () => {
  it('declares its name, grammar and summary', () => {
    expect(command.name).toBe('unfollow');
    expect(command.usage).toBe('/unfollow [target]');
    expect(command.summary).toBe('Take a follow back');
    expect(command.bindings).toBeUndefined();
  });

  it('unfollows the author of the post a label names', async () => {
    const calls = serveAccountActions({ id: '2' });
    const context = homeContext([FOREIGN]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/unfollow', body: undefined }]);
    expect(context.print).toHaveBeenCalledWith('unfollowed @smiling@wired.example');
  });
});
