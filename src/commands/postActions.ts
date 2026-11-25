/**
 * The command lines behind a post card's action bar (decision 6, WFE-209):
 * every button and menu row is a click target that runs the same line its
 * command does, so the lines come from the registry, not from the card. A
 * command the registry does not carry (the backend cannot do it, WFE-172) has
 * no line, which is how its button goes missing. A command whose default
 * hotkey fills the line instead of running it (`Shift+e`, …) is a prefill
 * here too, so a click and the hotkey are one path. The exceptions are reply
 * (WFE-244), quote (WFE-262) and edit (WFE-268): `r`, `q` and `e` prefill for
 * the power user, but the buttons run `/reply a3`, `/quote a3` and `/edit a3`
 * with no text, which open a composer bound to the post. The other exceptions
 * are react (WFE-265): `Shift+e` prefills, but the button opens the emoji
 * picker, whose choice runs `/react a3 <emoji>` or `/unreact a3 <emoji>`; its
 * line is marked `picker`, and with no `/react` in the registry it has no line
 * and so no button; delete and block (WFE-266): `Shift+d` and `Shift+x`
 * prefill, and Enter on the filled line is the confirmation, but a click on
 * the `⋯` row asks in a dialog first, so their lines carry `confirm` instead
 * of `prefill`; and mute (WFE-267): `Shift+m` prefills so a duration can be
 * typed after it, but a click on the `⋯` row opens a dialog that picks the
 * duration, so its line carries `confirm: 'mute'` too and the dialog appends
 * the duration word before running it. `media` (WFE-264) has no button of its
 * own: its line is what a click on a post's attachment runs, and with no
 * `/media` in the registry the attachment links stay the browser's.
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
  'media',
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
  /** True makes the click open the emoji picker rather than hand the line on. */
  readonly picker?: true;
  /** Present when a click asks in a dialog before running the line. */
  readonly confirm?: 'delete' | 'block' | 'mute';
};

/** The actions whose button runs its line although the command's hotkey prefills it. */
const RUNS_ON_CLICK: ReadonlySet<PostActionName> = new Set<PostActionName>([
  'reply',
  'quote',
  'edit',
]);

/** The actions whose button opens the emoji picker, which then runs the command. */
const OPENS_PICKER: ReadonlySet<PostActionName> = new Set<PostActionName>(['react']);

/** Whether {@link name}'s default navigation hotkey fills its line rather than running it. */
function prefills(name: PostActionName, definition: CommandDefinition): boolean {
  if (RUNS_ON_CLICK.has(name)) {
    return false;
  }
  return (definition.bindings ?? []).some(
    (binding) => binding.mode === 'navigation' && binding.prefill === true,
  );
}

/**
 * The line {@link name}'s button hands on, opens the picker with, or asks
 * about in a dialog first, for the post {@link label}.
 */
function lineFor(
  name: PostActionName,
  definition: CommandDefinition,
  label: string,
): PostActionLine {
  const line = `/${name} ${label}`;
  if (OPENS_PICKER.has(name)) {
    return { line, prefill: false, picker: true };
  }
  if (name === 'delete' || name === 'block' || name === 'mute') {
    return { line, prefill: false, confirm: name };
  }
  return { line, prefill: prefills(name, definition) };
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
      lines[name] = lineFor(name, definition, label);
    }
  }
  return lines;
}
