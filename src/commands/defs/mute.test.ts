/**
 * Tests for /mute: the definition the command line, /help and completion
 * read, and a mute carrying its duration — `2h` sent as 7200 seconds and
 * echoed in the printed `muted @x for 2h`. The duration parser's every
 * branch and the forever mute live in ../accountToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './mute';
import { status } from '../../test/fixtures';
import { FOREIGN_WIRE, homeContext, serveAccountActions } from '../../test/homeWindow';

/** A post by smiling: its author is the account the mute acts on. */
const FOREIGN = status('q', { account: FOREIGN_WIRE });

describe('/mute', () => {
  it('declares its name, grammar, summary and hotkey', () => {
    expect(command.name).toBe('mute');
    expect(command.usage).toBe('/mute [target] [duration]');
    expect(command.summary).toBe('Mute an account');
    expect(command.bindings).toStrictEqual([
      { mode: 'navigation', chord: 'Shift+m', args: '{label}', prefill: true },
    ]);
  });

  it('mutes for a duration, sent as seconds and echoed as typed', async () => {
    const calls = serveAccountActions({ id: '2', muting: true });
    const context = homeContext([FOREIGN]);

    const outcome = await command.run('a0 2h', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/mute', body: { duration: 7200 } }]);
    expect(context.print).toHaveBeenCalledWith('muted @smiling@wired.example for 2h');
  });
});
