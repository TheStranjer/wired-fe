/**
 * Tests for /block: the definition the command line, /help and completion
 * read, and the author of the selected post blocked — printed `blocked @x`.
 * The shared body and every refusal live in ../accountToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './block';
import { status } from '../../test/fixtures';
import { FOREIGN_WIRE, homeContext, serveAccountActions } from '../../test/homeWindow';

/** A post by smiling: its author is the account the block acts on. */
const FOREIGN = status('q', { account: FOREIGN_WIRE });

describe('/block', () => {
  it('declares its name, grammar, summary and hotkey', () => {
    expect(command.name).toBe('block');
    expect(command.usage).toBe('/block [target]');
    expect(command.summary).toBe('Block an account');
    expect(command.bindings).toStrictEqual([
      { mode: 'navigation', chord: 'Shift+x', args: '{label}', prefill: true },
    ]);
  });

  it('blocks the author of the selected post', async () => {
    const calls = serveAccountActions({ id: '2', blocking: true });
    const context = homeContext([FOREIGN], 'q');

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/block', body: undefined }]);
    expect(context.print).toHaveBeenCalledWith('blocked @smiling@wired.example');
  });
});
