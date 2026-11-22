/**
 * Tests for /unmute: the definition the command line, /help and completion
 * read, and a mute taken back from the author of the selected post however
 * long it ran — printed `unmuted @x`. The shared body and every refusal live
 * in ../accountToggle.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command } from './unmute';
import { status } from '../../test/fixtures';
import { FOREIGN_WIRE, homeContext, serveAccountActions } from '../../test/homeWindow';

/** A post by smiling: its author is the account the unmute acts on. */
const FOREIGN = status('q', { account: FOREIGN_WIRE });

describe('/unmute', () => {
  it('declares its name, grammar and summary', () => {
    expect(command.name).toBe('unmute');
    expect(command.usage).toBe('/unmute [target]');
    expect(command.summary).toBe('Take a mute back');
    expect(command.bindings).toBeUndefined();
  });

  it('unmutes the author of the selected post', async () => {
    const calls = serveAccountActions({ id: '2' });
    const context = homeContext([FOREIGN], 'q');

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/unmute', body: undefined }]);
    expect(context.print).toHaveBeenCalledWith('unmuted @smiling@wired.example');
  });
});
