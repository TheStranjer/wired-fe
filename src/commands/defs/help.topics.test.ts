/**
 * Tests for `/help <topic>` (WFE-252): `layout`, `feeds` and `sync` print
 * their paragraph and then the summary of each command they cover that the
 * registry has, in any letter case and with a slash; a topic wins over the
 * command of the same name; and a registry without the covered commands
 * leaves their lines out.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './help';
import { fakeCommandContext } from '../../test/commandContext';
import { loadDefinitions } from '../definitions';
import { HELP_TOPICS } from '../helpTopics';
import { buildRegistry } from '../registry';
import type { CommandContext } from '../types';

/** A context over the registry of {@link names}, or of every shipped command when none are given. */
function contextOver(names?: readonly string[]): CommandContext {
  const definitions = loadDefinitions();
  if (!definitions.ok) {
    throw new Error(definitions.error);
  }
  const chosen =
    names === undefined
      ? definitions.value
      : definitions.value.filter((definition) => names.includes(definition.name));
  const built = buildRegistry(chosen);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return fakeCommandContext({ registry: built.value });
}

/** Every line {@link context} printed, in order. */
function printed(context: CommandContext): readonly string[] {
  return vi.mocked(context.print).mock.calls.map(([text]) => text);
}

describe('/help <topic>', () => {
  it.each(HELP_TOPICS.map((topic) => [topic.name, topic] as const))(
    'prints the paragraph of %s and one line per covered command',
    async (_name, topic) => {
      const context = contextOver();

      const outcome = await command.run(topic.name, context);

      expect(outcome).toStrictEqual({ ok: true });
      const lines = printed(context);
      expect(lines[0]).toBe(`${topic.name} — ${topic.text}`);
      expect(lines.slice(1).map((line) => line.split(' — ')[0])).toStrictEqual(
        topic.commands.map((name) => `  /${name}`),
      );
    },
  );

  it('prints the topic, not the command, for /help sync', async () => {
    const context = contextOver();

    await command.run('sync', context);

    expect(printed(context)[0]).toMatch(/^sync — Your desk /u);
    expect(printed(context)).toContain('  /sync — Choose which account holds your synced desk');
  });

  it('ignores a leading slash and letter case', async () => {
    const context = contextOver();

    await command.run('/LAYOUT', context);

    expect(printed(context)[0]).toMatch(/^layout — /u);
  });

  it('leaves out the covered commands the registry does not have', async () => {
    const context = contextOver(['help', 'feed']);

    await command.run('feeds', context);

    expect(printed(context)).toHaveLength(2);
    expect(printed(context)[1]).toMatch(/^ {2}\/feed — /u);
  });

  it('lists the topics under the commands', async () => {
    const context = contextOver(['help']);

    await command.run('', context);

    expect(printed(context)).toContain('Topics: layout, feeds, sync (/help <topic>)');
  });
});
