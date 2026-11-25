/**
 * `/help` (decision 6): the command list and the details of one command,
 * generated from the registry so every command documents itself by being
 * defined. No argument prints one line per command in registry order; one
 * argument (a leading slash allowed and ignored, any case, matched against
 * names and aliases) prints that command's usage, summary, aliases and
 * default keys. Words beyond the first are ignored. Only the commands the
 * active account's backend can do are listed (WFE-172); asking about one it
 * cannot do says why.
 */

import { unavailableRefusal } from '../available';
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
  const subject = subjectOf(args);
  if (subject === undefined) {
    return listAll(context);
  }
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
  usage: '/help [command]',
  summary: 'List commands, or show help for one',
  run: syncRun(handle),
  bindings: [{ mode: 'navigation', chord: '?', args: '' }],
};
