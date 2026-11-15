/**
 * Tests for /unbookmark: the definition the command line, /help and completion
 * read, and the undo sent for a post a label names — the bookmark gone from
 * every scrollback, the window printing `🔖 unbookmarked [a0]`. Both directions
 * of every toggle live in ../statusToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './unbookmark';
import { status } from '../../test/fixtures';
import { homeContext, serveStatusActions } from '../../test/homeWindow';

/** lain's post, still bookmarked. */
const POST = status('p', { bookmarked: true });

describe('/unbookmark', () => {
  it('declares its name and grammar and binds no key', () => {
    expect(command.name).toBe('unbookmark');
    expect(command.aliases).toStrictEqual([]);
    expect(command.usage).toBe('/unbookmark [label]');
    expect(command.summary).toBe('Remove your bookmark of a post');
    expect(command.bindings).toBeUndefined();
  });

  it('sends the undo for the post a label names', async () => {
    const paths = serveStatusActions(status('p'));
    const context = homeContext([POST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/unbookmark']);
    expect(context.print).toHaveBeenCalledWith('🔖 unbookmarked [a0]');
  });
});
