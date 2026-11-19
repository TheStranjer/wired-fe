/**
 * Tests for /unpin: the definition the command line, /help and completion read,
 * the undo sent for a post a label names, and the same author-only refusal as
 * /pin — an account cannot unpin what it never could pin. Both directions of
 * every toggle live in ../statusToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './unpin';
import { status } from '../../test/fixtures';
import { FOREIGN_WIRE, homeContext, serveStatusActions } from '../../test/homeWindow';

/** lain's own post, pinned to her profile. */
const POST = status('p', { pinned: true });

describe('/unpin', () => {
  it('declares its name and grammar and binds no key', () => {
    expect(command.name).toBe('unpin');
    expect(command.aliases).toBeUndefined();
    expect(command.usage).toBe('/unpin [label]');
    expect(command.summary).toBe('Unpin one of your own posts');
    expect(command.bindings).toBeUndefined();
  });

  it('sends the undo for the post a label names', async () => {
    const paths = serveStatusActions(status('p'));
    const context = homeContext([POST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/unpin']);
    expect(context.print).toHaveBeenCalledWith('📌 unpinned [a0]');
  });

  it('refuses a post of somebody else without sending', async () => {
    const paths = serveStatusActions(POST);
    const context = homeContext([status('q', { account: FOREIGN_WIRE })]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'You can only pin your own posts' });
    expect(paths).toStrictEqual([]);
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
