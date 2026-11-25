/**
 * `/help` (decision 6): the command list, the details of one command and the
 * help topics, generated from the registry so every command documents itself
 * by being defined. No argument prints one line per command in registry
 * order and the topic names; one argument (a leading slash allowed and
 * ignored, any case) prints a topic of that name (`layout`, `feeds`, `sync`:
 * src/commands/helpTopics.ts) or else that command's usage, summary, aliases
 * and default keys, matched against names and aliases. A topic wins over a
 * command of the same name (`/help sync` is the topic), and lists that command's
 * summary among its own.
 * Words beyond the first are ignored. Only the commands the active account's
 * backend can do are listed (WFE-172); asking about one it cannot do says why.
 */

import { unavailableRefusal } from '../available';
import { HELP_TOPICS, type HelpTopic, findTopic } from '../helpTopics';
import { OK, fail, syncRun } from '../outcome';
import { lookupCommand } from '../registry';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Bookends of the command listing. */
const HEADER = 'Commands:';
const FOOTER = 'Type /help <command> for details.';

/**
 * The first whitespace-separated word of {@link args} with a leading slash
 * removed; undefined when the argument text holds no word at all.
 */
function subjectOf(args: string): string | undefined {
  const trimmed = args.trim();
  if (trimmed === '') {
    return undefined;
  }
  const [word = ''] = trimmed.split(/\s+/u);
  return word.startsWith('/') ? word.slice(1) : word;
}

/** Print the header, one line per command in registry order, then the footer. */
function listAll(context: CommandContext): CommandOutcome {
  context.print(HEADER);
  for (const definition of context.registry.commands) {
    context.print(`  /${definition.name} — ${definition.summary}`);
  }
  context.print(`Topics: ${HELP_TOPICS.map((topic) => topic.name).join(', ')} (/help <topic>)`);
  context.print(FOOTER);
  return OK;
}

/** Print a topic's paragraph, then the summary of each command it covers that this backend has. */
function showTopic(topic: HelpTopic, context: CommandContext): CommandOutcome {
  context.print(`${topic.name} — ${topic.text}`);
  for (const name of topic.commands) {
    const definition = lookupCommand(context.registry, name);
    if (definition !== undefined) {
      context.print(`  /${definition.name} — ${definition.summary}`);
    }
  }
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

/** Do what one argument text asks: list every command, or detail one command or topic. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const subject = subjectOf(args);
  if (subject === undefined) {
    return listAll(context);
  }
  const word = subject.toLowerCase();
  const topic = findTopic(word);
  if (topic !== undefined) {
    return showTopic(topic, context);
  }
  const definition = lookupCommand(context.registry, word);
  if (definition === undefined) {
    return fail(unavailableRefusal(context, word) ?? `No such command: /${subject}`);
  }
  return showDetails(definition, context);
}

/** The `/help` (alias `/h`) definition. */
export const command: CommandDefinition = {
  name: 'help',
  aliases: ['h'],
  usage: '/help [command|topic]',
  summary: 'List commands, or show help for one',
  run: syncRun(handle),
  bindings: [{ mode: 'navigation', chord: '?', args: '' }],
};
