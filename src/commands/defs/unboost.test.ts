/**
 * Tests for /unboost: the definition the command line, /help and completion
 * read, and the undo sent for a post the scrollback showed as a boost — the
 * original takes the unreblog, its reblog count coming back in the answered
 * status. Both directions of every toggle live in ../statusToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './unboost';
import { status } from '../../test/fixtures';
import { homeContext, serveStatusActions } from '../../test/homeWindow';

/** lain's post, still boosted. */
const POST = status('p', { reblogged: true });

/** A boost line showing {@link POST}: the undo follows the original. */
const BOOST = status('b', { reblog: POST });

describe('/unboost', () => {
  it('declares its name and grammar and binds no key', () => {
    expect(command.name).toBe('unboost');
    expect(command.aliases).toBeUndefined();
    expect(command.usage).toBe('/unboost [label]');
    expect(command.summary).toBe('Take your boost of a post back');
    expect(command.bindings).toBeUndefined();
  });

  it('unboosts the original of the boost a label names', async () => {
    const unboosted = status('p', { reblogs_count: 1 });
    const paths = serveStatusActions(unboosted);
    const context = homeContext([BOOST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/unreblog']);
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'statusUpdated',
      status: unboosted,
    });
    expect(context.print).toHaveBeenCalledWith('⟳ unboosted [a0]');
  });
});
