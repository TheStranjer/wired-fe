/**
 * The command lines behind a post card's action bar (decision 6, WFE-209):
 * every button and menu row is a click target that runs the same line its
 * command does, so the lines come from the registry, not from the card. A
 * command the registry does not carry (the backend cannot do it, WFE-172) has
 * no line, which is how its button goes missing. A command whose default
 * hotkey fills the line instead of running it (`r`, `Shift+e`, …) is a
 * prefill here too, so a click and the hotkey are one path.
 */

import type { CommandDefinition, Registry } from './types';

/** The commands a card's buttons and its more-menu can run, each on one post. */
const POST_ACTION_NAMES = [
  'reply',
  'boost',
  'unboost',
  'fav',
  'unfav',
  'react',
  'bookmark',
  'unbookmark',
  'quote',
  'copy',
  'open',
  'thread',
  'pin',
  'unpin',
  'edit',
  'delete',
  'mute',
  'block',
] as const;

/** The name of one command a card can run. */
type PostActionName = (typeof POST_ACTION_NAMES)[number];

/** One command line for a card's click target, and whether it only fills the input. */
type PostActionLine = {
  /** The line, e.g. `/boost a3`. */
  readonly line: string;
  /** True fills the line into the command line for the user to finish. */
  readonly prefill: boolean;
};

/** Whether the command's default navigation hotkey fills its line rather than running it. */
function prefills(definition: CommandDefinition): boolean {
  return (definition.bindings ?? []).some(
    (binding) => binding.mode === 'navigation' && binding.prefill === true,
  );
}

/**
 * The line each card action runs on the post labelled {@link label}, for the
 * commands {@link registry} carries; the ones it hides are left out.
 */
export function postActionLines(
  registry: Registry,
  label: string,
): Partial<Record<PostActionName, PostActionLine>> {
  const lines: Partial<Record<PostActionName, PostActionLine>> = {};
  for (const name of POST_ACTION_NAMES) {
    const definition = registry.byName.get(name);
    if (definition !== undefined) {
      lines[name] = { line: `/${name} ${label}`, prefill: prefills(definition) };
    }
  }
  return lines;
}
