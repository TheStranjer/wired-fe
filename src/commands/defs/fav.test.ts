/**
 * Tests for /fav: the definition the command line, /help, completion and the
 * keymap read, and one favourite sent to the instance — the answered post
 * shared with every scrollback and `★ favourited [a0]` printed. Both directions
 * of every toggle, and of /unfav, live in ../statusToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './fav';
import { status } from '../../test/fixtures';
import { homeContext, serveStatusActions } from '../../test/homeWindow';

/** lain's post, unfavourited. */
const POST = status('p');

describe('/fav', () => {
  it('declares its name, aliases, grammar and hotkey', () => {
    expect(command.name).toBe('fav');
    expect(command.aliases).toStrictEqual(['f', 'like']);
    expect(command.usage).toBe('/fav [label]');
    expect(command.summary).toBe('Favourite a post, or take the favourite back');
    expect(command.bindings).toStrictEqual([{ mode: 'navigation', chord: 'f', args: '' }]);
  });

  it('favourites the post a label names', async () => {
    const answered = status('p', { favourited: true });
    const paths = serveStatusActions(answered);
    const context = homeContext([POST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/favourite']);
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: answered });
    expect(context.print).toHaveBeenCalledWith('★ favourited [a0]');
  });

  it('runs as /like and takes an already favourited post back', async () => {
    const paths = serveStatusActions(POST);
    const context = homeContext([status('p', { favourited: true })]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/unfavourite']);
    expect(context.print).toHaveBeenCalledWith('★ unfavourited [a0]');
  });
});
