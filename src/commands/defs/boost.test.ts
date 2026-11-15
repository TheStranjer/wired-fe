/**
 * Tests for /boost: the definition the command line, /help, completion and the
 * keymap read, and one boost sent to the instance — the original inside the
 * wrapper answer shared with every scrollback and `⟳ boosted [a0]` printed.
 * Both directions of every toggle live in ../statusToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './boost';
import { status } from '../../test/fixtures';
import { homeContext, serveStatusActions } from '../../test/homeWindow';

/** The post as the scrollback shows it, unboosted. */
const POST = status('p');

describe('/boost', () => {
  it('declares its name, aliases, grammar and hotkey', () => {
    expect(command.name).toBe('boost');
    expect(command.aliases).toStrictEqual(['rt', 'reblog']);
    expect(command.usage).toBe('/boost [label]');
    expect(command.summary).toBe('Boost a post, or take the boost back');
    expect(command.bindings).toStrictEqual([{ mode: 'navigation', chord: 'b', args: '' }]);
  });

  it('boosts the post a label names and shares the boosted original', async () => {
    const boosted = status('p', { reblogged: true });
    const paths = serveStatusActions(status('w', { reblog: boosted }));
    const context = homeContext([POST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/reblog']);
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: boosted });
    expect(context.print).toHaveBeenCalledWith('⟳ boosted [a0]');
  });

  it('runs as /reblog and takes a boosted post back', async () => {
    const paths = serveStatusActions(POST);
    const context = homeContext([status('p', { reblogged: true })]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/unreblog']);
    expect(context.print).toHaveBeenCalledWith('⟳ unboosted [a0]');
  });
});
