/**
 * Tests for /bookmark: the definition the command line, /help, completion and
 * the keymap read, and one bookmark kept and taken back — the answered post
 * shared with every scrollback and `🔖 bookmarked [a0]` printed. Both
 * directions of every toggle live in ../statusToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './bookmark';
import { status } from '../../test/fixtures';
import { homeContext, serveStatusActions } from '../../test/homeWindow';

/** lain's post, unbookmarked. */
const POST = status('p');

describe('/bookmark', () => {
  it('declares its name, grammar and hotkey and nothing else', () => {
    expect(command.name).toBe('bookmark');
    expect(command.aliases).toStrictEqual([]);
    expect(command.usage).toBe('/bookmark [label]');
    expect(command.summary).toBe('Bookmark a post, or remove the bookmark');
    expect(command.bindings).toStrictEqual([{ mode: 'navigation', chord: 'Shift+b', args: '' }]);
  });

  it('bookmarks the post a label names', async () => {
    const answered = status('p', { bookmarked: true });
    const paths = serveStatusActions(answered);
    const context = homeContext([POST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/bookmark']);
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: answered });
    expect(context.print).toHaveBeenCalledWith('🔖 bookmarked [a0]');
  });

  it('takes an already bookmarked post out of the bookmarks', async () => {
    const paths = serveStatusActions(POST);
    const context = homeContext([status('p', { bookmarked: true })]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/unbookmark']);
    expect(context.print).toHaveBeenCalledWith('🔖 unbookmarked [a0]');
  });
});
