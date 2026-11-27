/**
 * Tests for the `/help <topic>` pages (layout, feeds, sync): each prints its
 * paragraph and one line per covered command, a topic never lists a command
 * the shipped registry lacks, a command with the topic's name stays reachable
 * with a slash, and a backend without a covered command just omits its line.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './help';
import { fakeCommandContext } from '../../test/commandContext';
import { loadDefinitions } from '../definitions';
import { HELP_TOPICS, lookupTopic } from '../helpTopics';
import { buildRegistry } from '../registry';
import type { CommandContext, Registry } from '../types';

/** The registry of every shipped command. */
function shippedRegistry(): Registry {
  const definitions = loadDefinitions();
  if (!definitions.ok) {
    throw new Error(definitions.error);
  }
  const built = buildRegistry(definitions.value);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return built.value;
}

/**
 * The longest a topic line may be. One long catalog message made Prism's
 * translation request time out (WFE-334), so each line stays a sentence or two.
 */
const MAX_LINE_LENGTH = 300;

/** A context over {@link registry} whose print records. */
function contextOver(registry: Registry): CommandContext {
  return fakeCommandContext({ registry, print: vi.fn() });
}

/** Every line {@link context} printed, in order. */
function printed(context: CommandContext): readonly string[] {
  return vi.mocked(context.print).mock.calls.map(([text]) => text);
}

describe('the help topics', () => {
  it('are layout, feeds and sync, each with several lines of text', () => {
    expect(HELP_TOPICS.map((topic) => topic.name)).toStrictEqual(['layout', 'feeds', 'sync']);

    for (const topic of HELP_TOPICS) {
      expect(topic.lines.length).toBeGreaterThan(1);
      expect(topic.lines.join(' ').length).toBeGreaterThan(100);
    }
  });

  it('keep every line short enough for the translator to take in one request', () => {
    for (const topic of HELP_TOPICS) {
      for (const line of topic.lines) {
        expect(line.length).toBeGreaterThan(0);
        expect(line.length).toBeLessThanOrEqual(MAX_LINE_LENGTH);
      }
    }
  });

  it.each(HELP_TOPICS.map((topic) => [topic.name, topic] as const))(
    'list only existing, canonical commands once in %s',
    (_name, topic) => {
      const registry = shippedRegistry();

      expect(new Set(topic.commands).size).toBe(topic.commands.length);

      for (const name of topic.commands) {
        expect(registry.byName.get(name)?.name).toBe(name);
      }
    },
  );

  it('are found by name and by nothing else', () => {
    expect(lookupTopic('layout')?.name).toBe('layout');
    expect(lookupTopic('nope')).toBeUndefined();
  });
});

describe('/help <topic>', () => {
  it.each(HELP_TOPICS.map((topic) => [topic.name, topic] as const))(
    'prints the %s paragraph, its commands and the footer',
    async (name, topic) => {
      const registry = shippedRegistry();
      const context = contextOver(registry);

      const outcome = await command.run(name, context);

      const lines = topic.commands.map((commandName) => {
        const definition = registry.byName.get(commandName);
        return `  /${commandName} — ${definition?.summary ?? ''}`;
      });

      expect(outcome).toStrictEqual({ ok: true });
      expect(printed(context)).toStrictEqual([
        ...topic.lines,
        ...lines,
        'Type /help <command> for details.',
      ]);
    },
  );

  it('ignores letter case and extra words', async () => {
    const context = contextOver(shippedRegistry());

    await command.run('  LAYOUT more words', context);

    expect(printed(context)[0]).toBe(lookupTopic('layout')?.lines[0]);
  });

  it('keeps /help /sync for the command itself', async () => {
    const context = contextOver(shippedRegistry());

    await command.run('/sync', context);

    expect(printed(context)[0]).toContain('/sync primary <handle>');
    expect(printed(context)).not.toContain(lookupTopic('sync')?.lines[0]);
  });

  it('leaves out the covered commands the registry does not have', async () => {
    const context = fakeCommandContext({ print: vi.fn() });

    await command.run('sync', context);

    expect(printed(context)).toStrictEqual([
      ...(lookupTopic('sync')?.lines ?? []),
      'Type /help <command> for details.',
    ]);
  });

  it('names the topics in the listing', async () => {
    const context = contextOver(shippedRegistry());

    await command.run('', context);

    expect(printed(context)).toContain('Topics: layout, feeds, sync. Type /help <topic>.');
  });
});
