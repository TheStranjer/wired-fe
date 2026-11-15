/**
 * Tests for the command dispatcher: routing by what parseInput found,
 * registry lookup by name and alias, and the promise that every failure
 * path prints an error instead of throwing out of dispatchInput.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { dispatchInput, type TextHandler } from './dispatch';
import { buildRegistry } from './registry';
import type { CommandContext, CommandDefinition, CommandOutcome, Registry } from './types';
import { fakeCommandContext } from '../test/commandContext';

/** A text handler no command test should ever reach. */
const NEVER_TEXT: TextHandler = vi.fn<TextHandler>();

/** The context print, with vitest's call history. */
type PrintMock = Mock<CommandContext['print']>;

/** A stub context printing into {@link print} over {@link registry}. */
function stubContext(registry: Registry): {
  readonly context: CommandContext;
  readonly print: PrintMock;
} {
  const print: PrintMock = vi.fn();
  return { context: fakeCommandContext({ registry, print }), print };
}

/** A definition these tests consider well-formed, running whatever {@link run} does. */
function fakeCommand(
  name: string,
  aliases: readonly string[],
  run: (args: string, context: CommandContext) => Promise<CommandOutcome>,
): CommandDefinition {
  return { name, aliases, usage: `/${name}`, summary: `Do the ${name} thing.`, run };
}

/** The registry built from definitions these tests consider valid. */
function built(definitions: readonly CommandDefinition[]): Registry {
  const result = buildRegistry(definitions);
  if (!result.ok) {
    throw new Error(`buildRegistry unexpectedly rejected definitions: ${result.error}`);
  }
  return result.value;
}

/** A run mock resolving to {@link outcome}. */
function commandRun(outcome: CommandOutcome) {
  return vi
    .fn<(args: string, context: CommandContext) => Promise<CommandOutcome>>()
    .mockResolvedValue(outcome);
}

describe(dispatchInput, () => {
  it('does nothing on empty input', async () => {
    const { context, print } = stubContext(built([]));
    const onText = vi.fn<TextHandler>();

    await dispatchInput('   ', context, onText);

    expect(print).not.toHaveBeenCalled();
    expect(onText).not.toHaveBeenCalled();
  });

  it('hands plain text to the text handler', async () => {
    const { context, print } = stubContext(built([]));
    const onText = vi.fn<TextHandler>();

    await dispatchInput('hello world', context, onText);

    expect(onText).toHaveBeenCalledWith('hello world');
    expect(print).not.toHaveBeenCalled();
  });

  it('passes a doubled slash through as the literal text', async () => {
    const { context } = stubContext(built([]));
    const onText = vi.fn<TextHandler>();

    await dispatchInput('//x', context, onText);

    expect(onText).toHaveBeenCalledWith('/x');
  });

  it('prints the reason for invalid input and runs no command', async () => {
    const run = commandRun({ ok: true });
    const { context, print } = stubContext(built([fakeCommand('fav', [], run)]));

    await dispatchInput('/ 3', context, NEVER_TEXT);

    expect(print).toHaveBeenCalledWith('Missing command name after /', 'error');
    expect(run).not.toHaveBeenCalled();
  });

  it('prints an unknown command verbatim, suggesting /help', async () => {
    const { context, print } = stubContext(
      built([fakeCommand('fav', [], commandRun({ ok: true }))]),
    );

    await dispatchInput('/nope a3', context, NEVER_TEXT);

    expect(print).toHaveBeenCalledWith('Unknown command: /nope. Try /help', 'error');
  });

  it('runs a known command with its rest and the same context, printing nothing', async () => {
    const run = commandRun({ ok: true });
    const { context, print } = stubContext(built([fakeCommand('fav', [], run)]));

    await dispatchInput('/fav  a3 extra', context, NEVER_TEXT);

    expect(run).toHaveBeenCalledWith('a3 extra', context);
    expect(print).not.toHaveBeenCalled();
  });

  it('finds a command by its alias', async () => {
    const run = commandRun({ ok: true });
    const { context, print } = stubContext(built([fakeCommand('fav', ['f'], run)]));

    await dispatchInput('/f a3', context, NEVER_TEXT);

    expect(run).toHaveBeenCalledWith('a3', context);
    expect(print).not.toHaveBeenCalled();
  });

  it('prints a failed outcome as its error', async () => {
    const run = commandRun({ ok: false, message: 'No post labelled [a3]' });
    const { context, print } = stubContext(built([fakeCommand('fav', [], run)]));

    await dispatchInput('/fav a3', context, NEVER_TEXT);

    expect(print).toHaveBeenCalledWith('No post labelled [a3]', 'error');
  });

  it('prints a command that rejects as Command failed', async () => {
    const run = vi
      .fn<(args: string, context: CommandContext) => Promise<CommandOutcome>>()
      .mockRejectedValue(new Error('boom'));
    const { context, print } = stubContext(built([fakeCommand('fav', [], run)]));

    await expect(dispatchInput('/fav a3', context, NEVER_TEXT)).resolves.toBeUndefined();

    expect(print).toHaveBeenCalledWith('Command failed: boom', 'error');
  });

  it('prints a command that throws synchronously as Command failed', async () => {
    const run = vi
      .fn<(args: string, context: CommandContext) => Promise<CommandOutcome>>()
      .mockImplementation(() => {
        throw new Error('boom');
      });
    const { context, print } = stubContext(built([fakeCommand('fav', [], run)]));

    await dispatchInput('/fav a3', context, NEVER_TEXT);

    expect(print).toHaveBeenCalledWith('Command failed: boom', 'error');
  });

  it('stringifies a thrown value that is not an Error', async () => {
    const run = vi
      .fn<(args: string, context: CommandContext) => Promise<CommandOutcome>>()
      .mockRejectedValue('oops');
    const { context, print } = stubContext(built([fakeCommand('fav', [], run)]));

    await dispatchInput('/fav a3', context, NEVER_TEXT);

    expect(print).toHaveBeenCalledWith('Command failed: oops', 'error');
  });

  it('prints a text handler that rejects as Failed', async () => {
    const { context, print } = stubContext(built([]));
    const onText = vi.fn<TextHandler>().mockRejectedValue(new Error('boom'));

    await expect(dispatchInput('hello', context, onText)).resolves.toBeUndefined();

    expect(print).toHaveBeenCalledWith('Failed: boom', 'error');
  });
});
