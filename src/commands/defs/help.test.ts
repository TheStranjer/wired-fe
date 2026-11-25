/**
 * Tests for /help: the command list generated from the registry, the detail
 * block of one command reached by name, leading slash, other case and alias,
 * and the refusal of an unknown name. The registry is built with the real
 * buildRegistry from /help itself and one fake command, which declares no
 * aliases and no bindings to exercise the lines /help must then leave out.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './help';
import { fakeCommandContext } from '../../test/commandContext';
import { buildRegistry } from '../registry';
import type { CommandContext, CommandDefinition, CommandOutcome, Registry } from '../types';

/** A second command for the listing: no aliases, no bindings. */
const FAKE: CommandDefinition = {
  name: 'fake',
  aliases: [],
  usage: '/fake <thing>',
  summary: 'Do a fake thing',
  run: async (): Promise<CommandOutcome> => await Promise.resolve({ ok: true }),
};

/** The registry the tests run on, in the order buildRegistry sorts it. */
function stubRegistry(): Registry {
  const result = buildRegistry([command, FAKE]);
  if (!result.ok) {
    throw new Error(`buildRegistry unexpectedly rejected definitions: ${result.error}`);
  }
  return result.value;
}

/** A context over {@link stubRegistry} whose print is a recording mock. */
function stubContext(): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ registry: stubRegistry(), print }), print };
}

/** Every line the detail block of /help itself consists of, in order. */
const HELP_DETAILS: readonly (readonly [string])[] = [
  ['/help [command | topic]'],
  ['  List commands, or show help for one'],
  ['  Aliases: /h'],
  ['  Keys: ? (navigation)'],
];

describe('/help', () => {
  it('lists both commands in registry order with header and footer', async () => {
    const { context, print } = stubContext();

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([
      ['Commands:'],
      ['  /fake — Do a fake thing'],
      ['  /help — List commands, or show help for one'],
      ['Type /help <command> for details.'],
      ['Topics: layout, feeds, sync. Type /help <topic>.'],
    ]);
  });

  it('shows usage, summary, aliases and keys for its own name', async () => {
    const { context, print } = stubContext();

    const outcome = await command.run('help', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual(HELP_DETAILS);
  });

  it('ignores a leading slash and letter case', async () => {
    const { context, print } = stubContext();

    const outcome = await command.run('/HELP', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual(HELP_DETAILS);
  });

  it('finds the command by its alias', async () => {
    const { context, print } = stubContext();

    const outcome = await command.run('h', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual(HELP_DETAILS);
  });

  it('omits the aliases and keys lines for a command that has neither', async () => {
    const { context, print } = stubContext();

    const outcome = await command.run('fake', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([['/fake <thing>'], ['  Do a fake thing']]);
  });

  it('uses only the first word of the argument text', async () => {
    const { context, print } = stubContext();

    const outcome = await command.run('  help many extra words', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual(HELP_DETAILS);
  });

  it('refuses an unknown command without printing anything', async () => {
    const { context, print } = stubContext();

    const outcome = await command.run('nope', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'No such command: /nope' });
    expect(print).not.toHaveBeenCalled();
  });
});
