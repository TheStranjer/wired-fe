/**
 * Tests for the help topics (WFE-252): every command a topic covers, and
 * every `/word` its paragraph mentions, is a command of the shipped registry,
 * so a renamed or removed command fails here instead of staying in the help.
 */
import { describe, expect, it } from 'vitest';

import { loadDefinitions } from './definitions';
import { HELP_TOPICS, findTopic } from './helpTopics';
import { buildRegistry } from './registry';
import type { Registry } from './types';

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

/** The names after a slash that starts a word in {@link text}: `/vsplit`, not `h/j`. */
function slashWords(text: string): readonly string[] {
  return [...text.matchAll(/(?<![\w/])\/([a-z][a-z0-9-]*)/gu)].map((match) => match[1] ?? '');
}

describe('help topics', () => {
  it('are named layout, feeds and sync', () => {
    expect(HELP_TOPICS.map((topic) => topic.name)).toStrictEqual(['layout', 'feeds', 'sync']);
  });

  it.each(HELP_TOPICS.map((topic) => [topic.name, topic] as const))(
    'cover only commands that exist (%s)',
    (_name, topic) => {
      const { byName } = shippedRegistry();

      expect(topic.commands.length).toBeGreaterThan(0);
      for (const name of topic.commands) {
        expect(byName.get(name)?.name, `/${name}`).toBe(name);
      }
    },
  );

  it.each(HELP_TOPICS.map((topic) => [topic.name, topic] as const))(
    'mention only commands that exist (%s)',
    (_name, topic) => {
      const { byName } = shippedRegistry();
      const words = slashWords(topic.text);

      expect(words.length).toBeGreaterThan(0);
      for (const word of words) {
        expect(byName.has(word), `/${word}`).toBe(true);
      }
    },
  );

  it('finds a topic by name and nothing else', () => {
    expect(findTopic('sync')?.name).toBe('sync');
    expect(findTopic('nope')).toBeUndefined();
  });
});
