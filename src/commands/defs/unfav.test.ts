/**
 * Tests for /unfav: the definition the command line, /help and completion read,
 * and the undo sent for the post a label names — whether or not that post
 * carried the favourite, the window printing `★ unfavourited [a0]`. Both
 * directions of every toggle live in ../statusToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './unfav';
import { status } from '../../test/fixtures';
import { homeContext, serveStatusActions } from '../../test/homeWindow';

/** lain's post, unfavourited: the undo still sends. */
const POST = status('p');

describe('/unfav', () => {
  it('declares its name and grammar and binds no key', () => {
    expect(command.name).toBe('unfav');
    expect(command.aliases).toStrictEqual([]);
    expect(command.usage).toBe('/unfav [label]');
    expect(command.summary).toBe('Take your favourite of a post back');
    expect(command.bindings).toBeUndefined();
  });

  it('sends the undo for the post the selection stands on', async () => {
    const paths = serveStatusActions(POST);
    const context = homeContext([POST], 'p');

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/unfavourite']);
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: POST });
    expect(context.print).toHaveBeenCalledWith('★ unfavourited [a0]');
  });
});
