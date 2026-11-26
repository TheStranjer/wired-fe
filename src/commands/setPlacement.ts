/**
 * The dotted form of `/set` (decision 13): `/set openIn.<kind> <placement>`
 * chooses where windows of one kind open, over the `openIn` default, and
 * `/set openIn.<kind> default` takes the choice back; `/set openIn.<kind>`
 * shows it. The kinds are the window kinds (`thread`, `hashtag`, `dm`…), so
 * `/set openIn.thread vsplit` opens every thread beside the focused pane.
 * These settings are not in the `/set` listing's metadata, since the listing
 * has one row per knob; the ones that are set print under it.
 */

import { OK, fail } from './outcome';
import type { CommandContext, CommandOutcome } from './types';
import { t } from '../i18n/translate';
import {
  PLACEABLE_KINDS,
  PLACEMENTS,
  isPlaceableKind,
  isPlacement,
  withKindPlacement,
} from '../state/placement';
import type { Placement } from '../state/placement';
import type { WindowKind } from '../windows/model';

/** What a dotted key starts with. */
const PREFIX = 'openIn.';

/** The word that takes a kind's own choice back. */
const DEFAULT_WORD = 'default';

/** The one line `/set` prints for {@link kind}: its own placement, or that it follows the default. */
function kindLine(context: CommandContext, kind: WindowKind): string {
  const own = context.state.settings.openInByKind[kind];
  return `  ${PREFIX}${kind} = ${own ?? DEFAULT_WORD}`;
}

/** Print a line for every kind that has a placement of its own. */
export function listKindPlacements(context: CommandContext): void {
  for (const kind of PLACEABLE_KINDS) {
    if (context.state.settings.openInByKind[kind] !== undefined) {
      context.print(kindLine(context, kind));
    }
  }
}

/** Turn {@link kind} to {@link placement}, or back to the default for null, and say so. */
function turn(context: CommandContext, kind: WindowKind, placement: Placement | null): void {
  const openInByKind = withKindPlacement(context.state.settings.openInByKind, kind, placement);
  context.dispatch({ type: 'settings', settings: { openInByKind } });
  context.print(`${PREFIX}${kind} = ${placement ?? DEFAULT_WORD}`);
}

/** Do what `/set openIn.<kind> [word]` asks. */
function turnKind(context: CommandContext, kind: WindowKind, word: string): CommandOutcome {
  const lower = word.toLowerCase();
  if (lower === DEFAULT_WORD) {
    turn(context, kind, null);
    return OK;
  }
  if (!isPlacement(lower)) {
    return fail(
      t('commands.placement_takes', {
        key: `${PREFIX}${kind}`,
        words: `${PLACEMENTS.join('|')}|${DEFAULT_WORD}`,
      }),
    );
  }
  turn(context, kind, lower);
  return OK;
}

/**
 * Runs `/set` when its first word is a dotted `openIn.<kind>` key: shows the
 * kind's placement with no value, sets it with one. Null for any other key,
 * which the plain `/set` handles; an unknown kind or a third word is refused.
 */
export function setPerKind(args: string, context: CommandContext): CommandOutcome | null {
  const [key = '', value, extra] = args.trim().split(/\s+/u);
  if (!key.startsWith(PREFIX)) {
    return null;
  }
  const kind = key.slice(PREFIX.length);
  if (!isPlaceableKind(kind)) {
    return fail(t('commands.no_window_kind', { kind, kinds: PLACEABLE_KINDS.join(', ') }));
  }
  if (extra !== undefined) {
    const form = `[${PLACEMENTS.join('|')}|${DEFAULT_WORD}]`;
    return fail(t('commands.usage', { usage: `/set ${PREFIX}${kind} ${form}` }));
  }
  if (value === undefined) {
    context.print(kindLine(context, kind));
    return OK;
  }
  return turnKind(context, kind, value);
}
