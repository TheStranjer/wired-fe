/**
 * What the active account's backend can do (decision 5, decision 6, WFE-172):
 * a command that names the capability flags it `requires` exists only where
 * the backend carries them all. {@link availableCommands} narrows the full
 * registry to that, so /help, tab completion, the keymap and /binds — all read
 * off the registry — never offer what the server would refuse; the commands it
 * leaves out stay known as `hidden`, and {@link unavailableRefusal} says why
 * one typed anyway cannot run. Nobody signed in narrows nothing: there is no
 * backend to disagree with, and `/forgot` is for exactly that moment.
 */

import type { CommandContext, CommandDefinition, Registry } from './types';
import { type Capabilities, type FeatureFlag, hasFeature } from '../capabilities/capabilities';
import { requireFeature } from '../capabilities/requireFeature';

/** Whose backend the commands are narrowed to. */
export type CommandScope = {
  /** Whether any account is signed in; false shows every command. */
  readonly signedIn: boolean;
  /** What the active account's instance can do; null while that is not known. */
  readonly capabilities: Capabilities | null;
};

/** The flags {@link definition} requires, as a list: none, one or several. */
function requiredFlags(definition: CommandDefinition): readonly FeatureFlag[] {
  const { requires } = definition;
  if (requires === undefined) {
    return [];
  }
  return typeof requires === 'string' ? [requires] : requires;
}

/** Whether {@link definition} may exist in {@link scope}. */
function isAvailable(definition: CommandDefinition, scope: CommandScope): boolean {
  if (!scope.signedIn) {
    return true;
  }
  const { capabilities } = scope;
  const flags = requiredFlags(definition);
  return (
    flags.length === 0 || (capabilities !== null && flags.every((f) => hasFeature(capabilities, f)))
  );
}

/** {@link definition} with the usage its backend shows, when that depends on the backend. */
function adapted(definition: CommandDefinition, scope: CommandScope): CommandDefinition {
  const { usageFor } = definition;
  return usageFor === undefined
    ? definition
    : { ...definition, usage: usageFor(scope.capabilities) };
}

/** Every name and alias of {@link definitions}, mapped to the definition it belongs to. */
function indexed(definitions: readonly CommandDefinition[]): Map<string, CommandDefinition> {
  const index = new Map<string, CommandDefinition>();
  for (const definition of definitions) {
    for (const label of [definition.name, ...(definition.aliases ?? [])]) {
      index.set(label, definition);
    }
  }
  return index;
}

/**
 * {@link registry} narrowed to {@link scope}: the commands whose required
 * flags the backend carries (all of them while nobody is signed in), each with
 * the usage its backend shows. The ones left out are in `hidden`. The order
 * stays the registry's.
 */
export function availableCommands(registry: Registry, scope: CommandScope): Registry {
  const shown: CommandDefinition[] = [];
  const hidden: CommandDefinition[] = [];
  for (const definition of registry.commands) {
    if (isAvailable(definition, scope)) {
      shown.push(adapted(definition, scope));
    } else {
      hidden.push(definition);
    }
  }
  return { commands: shown, byName: indexed(shown), hidden: indexed(hidden) };
}

/**
 * The refusal for the command called {@link name} when the registry hides it
 * from the active account, e.g. "@alice@mastodon.test's server (Mastodon)
 * can't react to posts with emoji"; null when it is not hidden.
 */
export function unavailableRefusal(context: CommandContext, name: string): string | null {
  const definition = context.registry.hidden?.get(name);
  if (definition === undefined) {
    return null;
  }
  for (const flag of requiredFlags(definition)) {
    const gate = requireFeature(context, context.state.activeAccountKey, flag);
    if (!gate.ok) {
      return gate.error;
    }
  }
  return null;
}
