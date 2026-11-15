/**
 * Tests for /pin: the definition the command line, /help and the keymap read,
 * one own post pinned and one unpinned, and the refusal of a post of somebody
 * else's before anything leaves. Both directions of every toggle live in
 * ../statusToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './pin';
import { status } from '../../test/fixtures';
import { FOREIGN_WIRE, homeContext, serveStatusActions } from '../../test/homeWindow';

/** lain's own post, unpinned. */
const POST = status('p');

/** A post of somebody else's, which no pin command touches. */
const FOREIGN = status('q', { account: FOREIGN_WIRE });

describe('/pin', () => {
  it('declares its name, grammar and hotkey and nothing else', () => {
    expect(command.name).toBe('pin');
    expect(command.aliases).toStrictEqual([]);
    expect(command.usage).toBe('/pin [label]');
    expect(command.summary).toBe('Pin one of your own posts, or unpin it');
    expect(command.bindings).toStrictEqual([{ mode: 'navigation', chord: 'Shift+p', args: '' }]);
  });

  it("pins one of the acting account's own posts", async () => {
    const answered = status('p', { pinned: true });
    const paths = serveStatusActions(answered);
    const context = homeContext([POST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/pin']);
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: answered });
    expect(context.print).toHaveBeenCalledWith('📌 pinned [a0]');
  });

  it('takes a pinned post of its own back down', async () => {
    const paths = serveStatusActions(POST);
    const context = homeContext([status('p', { pinned: true })]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/unpin']);
    expect(context.print).toHaveBeenCalledWith('📌 unpinned [a0]');
  });

  it('refuses a post of somebody else without sending', async () => {
    const paths = serveStatusActions(POST);
    const context = homeContext([FOREIGN]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'You can only pin your own posts' });
    expect(paths).toStrictEqual([]);
    expect(context.print).not.toHaveBeenCalled();
  });
});
