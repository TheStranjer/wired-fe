/**
 * `/help` (decision 6): the command list, the details of one command and the
 * topic pages, generated from the registry so every command documents itself
 * by being defined. No argument prints one line per command in registry order
 * and the topic names; one argument (a leading slash allowed and ignored, any
 * case, matched against names and aliases) prints that command's usage,
 * summary, aliases and default keys, except that a topic name typed without a
 * slash (`/help layout`, `/help sync`) prints the topic: its paragraph and
 * the commands it covers (helpTopics.ts). Words beyond the first are ignored.
 * Only the commands the active account's backend can do are listed (WFE-172);
 * asking about one it cannot do says why.
 */

import { unavailableRefusal } from '../available';
import { HELP_TOPICS, type HelpTopic, lookupTopic } from '../helpTopics';
import { OK, fail, syncRun } from '../outcome';
import { lookupCommand } from '../registry';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Bookends of the command listing. */
const HEADER = 'Commands:';
const FOOTER = 'Type /help <command> for details.';

/** The first whitespace-separated word of {@link args}; undefined when there is none. */
function firstWord(args: string): string | undefined {
  const [word = ''] = args.trim().split(/\s+/u);
  return word === '' ? undefined : word;
}

/** Print the header, one line per command in registry order, then the footer. */
function listAll(context: CommandContext): CommandOutcome {
  context.print(HEADER);
  for (const definition of context.registry.commands) {
    context.print(`  /${definition.name} — ${definition.summary}`);
  }
  context.print(FOOTER);
  context.print(
    `Topics: ${HELP_TOPICS.map((topic) => topic.name).join(', ')}. Type /help <topic>.`,
  );
  return OK;
}

/** Print {@link topic}'s paragraph, then one line per covered command this backend has. */
function showTopic(topic: HelpTopic, context: CommandContext): CommandOutcome {
  context.print(topic.text);
  for (const name of topic.commands) {
    const definition = lookupCommand(context.registry, name);
    if (definition !== undefined) {
      context.print(`  /${definition.name} — ${definition.summary}`);
    }
  }
  context.print(FOOTER);
  return OK;
}

/** The `Aliases:` line of {@link definition}, or undefined when it has none. */
function aliasLine(definition: CommandDefinition): string | undefined {
  const aliases = definition.aliases ?? [];
  if (aliases.length === 0) {
    return undefined;
  }
  return `  Aliases: ${aliases.map((alias) => `/${alias}`).join(', ')}`;
}

/** The `Keys:` line of {@link definition}, or undefined when it binds none. */
function keyLine(definition: CommandDefinition): string | undefined {
  const bindings = definition.bindings ?? [];
  if (bindings.length === 0) {
    return undefined;
  }
  const keys = bindings.map((binding) => `${binding.chord} (${binding.mode})`);
  return `  Keys: ${keys.join(', ')}`;
}

/** Print one command's detail block: usage, summary, then aliases and keys. */
function showDetails(definition: CommandDefinition, context: CommandContext): CommandOutcome {
  context.print(definition.usage);
  context.print(`  ${definition.summary}`);
  for (const line of [aliasLine(definition), keyLine(definition)]) {
    if (line !== undefined) {
      context.print(line);
    }
  }
  return OK;
}

/** Do what one argument text asks: list every command, or detail exactly one. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const word = firstWord(args);
  if (word === undefined) {
    return listAll(context);
  }
  const topic = lookupTopic(word.toLowerCase());
  if (topic !== undefined) {
    return showTopic(topic, context);
  }
  const subject = word.startsWith('/') ? word.slice(1) : word;
  const definition = lookupCommand(context.registry, subject.toLowerCase());
  if (definition === undefined) {
    return fail(
      unavailableRefusal(context, subject.toLowerCase()) ?? `No such command: /${subject}`,
    );
  }
  return showDetails(definition, context);
}

/** The `/help` (alias `/h`) definition. */
export const command: CommandDefinition = {
  name: 'help',
  aliases: ['h'],
  usage: '/help [command | topic]',
  summary: 'List commands, or show help for one',
  run: syncRun(handle),
  bindings: [{ mode: 'navigation', chord: '?', args: '' }],
};
