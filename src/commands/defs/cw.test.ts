/**
 * Tests for /cw: the warning is the argument text's first token — bare, quoted
 * across spaces, unescaped from `\"`, or with quoted runs glued into a plain
 * word — and the text is the raw string after it, inner spacing and quotes and
 * all. A missing or empty warning, a missing text and an unterminated quote
 * echo the usage and post nothing; the error string the active window's post
 * handler answers with comes back as the command's failure.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './cw';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext, CommandOutcome } from '../types';

/** Every refused argument text echoes this. */
const USAGE_ERROR: CommandOutcome = { ok: false, message: 'Usage: /cw "warning" text' };

/** A context whose post handler refuses the draft with {@link message}. */
function refusingContext(message: string): CommandContext {
  return fakeCommandContext({ post: vi.fn<CommandContext['post']>().mockResolvedValue(message) });
}

describe('/cw', () => {
  it('posts a bare warning with the text behind it', async () => {
    const context = fakeCommandContext();

    const outcome = await command.run('spoilers she is everywhere', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.post).toHaveBeenCalledWith({
      text: 'she is everywhere',
      spoilerText: 'spoilers',
    });
  });

  it('keeps the text as typed, inner spacing and all', async () => {
    const context = fakeCommandContext();

    await command.run('warn hello   spaced-out  world', context);

    expect(context.post).toHaveBeenCalledWith({
      text: 'hello   spaced-out  world',
      spoilerText: 'warn',
    });
  });

  it('takes a quoted warning across whitespace', async () => {
    const context = fakeCommandContext();

    const outcome = await command.run('"lain spoilers" she is everywhere', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.post).toHaveBeenCalledWith({
      text: 'she is everywhere',
      spoilerText: 'lain spoilers',
    });
  });

  it('unescapes the quoted warning but leaves the text raw', async () => {
    const context = fakeCommandContext();

    await command.run('"say \\"hi\\"" he said "hi"', context);

    expect(context.post).toHaveBeenCalledWith({
      text: 'he said "hi"',
      spoilerText: 'say "hi"',
    });
  });

  it('joins quoted runs inside an otherwise plain warning', async () => {
    const context = fakeCommandContext();

    await command.run('a"b c"d text after', context);

    expect(context.post).toHaveBeenCalledWith({ text: 'text after', spoilerText: 'ab cd' });
  });

  it.each([
    ['no arguments at all', ''],
    ['blank arguments', '   '],
    ['no text after the warning', 'spoilers'],
    ['an empty warning', '"" text'],
    ['an unterminated quote', '"unterminated text'],
  ])('echoes the usage for %s', async (_name, args) => {
    const context = fakeCommandContext();

    const outcome = await command.run(args, context);

    expect(outcome).toStrictEqual(USAGE_ERROR);
    expect(context.post).not.toHaveBeenCalled();
  });

  it('reports what the post handler answers back', async () => {
    const context = refusingContext("You can't post in this window");

    const outcome = await command.run('warn the text', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "You can't post in this window",
    });
  });
});
