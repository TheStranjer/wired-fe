/**
 * The run `/vsplit` and `/split` share (decisions 12 and 13): split the
 * focused pane, and show in the new one either the same window (no argument),
 * an existing window (`win N`) or a view the existing open commands make
 * (`tag rust`, `home`…). Those commands are run unchanged with their window
 * ask held back, so handle lookups, labels, titles and refusals stay theirs;
 * the held `open` is dispatched only once the new pane has focus, which puts
 * the window in it. `/float <view>` reuses the same lookup and placement,
 * splitting and then tearing the new pane off.
 */

import { OK, fail } from './outcome';
import { lookupCommand } from './registry';
import type { CommandContext, CommandDefinition, CommandOutcome } from './types';
import { type ViewSpec, VIEW_WORDS, parseViewSpec } from './viewSpec';
import { t } from '../i18n/translate';
import { type Result, err, ok } from '../lib/result';
import type { OpenAction } from '../state/placement';
import type { LayoutAction } from '../windows/layoutAction';
import { windowId } from '../windows/model';
import type { SplitDir } from '../windows/splitTree';

/** What the new pane shows: the window's id, and the `open` that creates it when it is not yet open. */
export type Shown = { readonly windowId: string; readonly open: OpenAction | null };

/** The grammar line the commands print in their usage: the views a spec may name. */
export const VIEW_USAGE = `[${VIEW_WORDS.join('|')} …]`;

/** The window numbered {@link number}, or why there is none. */
function numbered(context: CommandContext, number: number): Result<Shown, string> {
  const win = context.windows.windows[number - 1];
  return win === undefined
    ? err(t('commands.no_window', { number: String(number) }))
    : ok({ windowId: win.id, open: null });
}

/** What showing {@link open} means: the window it names when already open, else the new one beside the active. */
function shownFor(context: CommandContext, open: OpenAction): Shown {
  const id = windowId(open.ref);
  const exists = context.windows.windows.some((win) => win.id === id);
  return exists ? { windowId: id, open: null } : { windowId: context.windows.activeId, open };
}

/** Runs the open command of {@link spec}, keeping the window it asks for instead of dispatching it. */
async function runOpen(
  context: CommandContext,
  spec: Extract<ViewSpec, { readonly type: 'open' }>,
): Promise<Result<Shown, string>> {
  const definition = lookupCommand(context.registry, spec.command);
  if (definition === undefined) {
    return err(t('commands.not_available_here', { command: spec.command }));
  }
  const asked: OpenAction[] = [];
  const outcome = await definition.run(spec.args, {
    ...context,
    placedByCaller: true,
    dispatchWindows: (action) => {
      if (action.type === 'open') {
        asked.push(action);
      }
    },
  });
  const [open] = asked;
  if (!outcome.ok) {
    return err(outcome.message);
  }
  return open === undefined
    ? err(t('commands.opened_no_window', { command: spec.command }))
    : ok(shownFor(context, open));
}

/** What the new pane shows for {@link spec}: a refusal's message on the error side. */
async function shownBy(context: CommandContext, spec: ViewSpec): Promise<Result<Shown, string>> {
  return spec.type === 'window' ? numbered(context, spec.number) : await runOpen(context, spec);
}

/**
 * What the argument text of a split or float command asks to show: the focused
 * window when it is blank, otherwise the view spec's window. A spec that does
 * not parse answers with its error and the {@link usage}; one that parses but
 * cannot open says why.
 */
export async function viewToShow(
  args: string,
  context: CommandContext,
  usage: string,
): Promise<Result<Shown, string>> {
  if (args.trim() === '') {
    return ok({ windowId: context.windows.activeId, open: null });
  }
  const spec = parseViewSpec(args);
  return spec.ok
    ? await shownBy(context, spec.value)
    : err(t('commands.error_with_usage', { error: spec.error, usage }));
}

/**
 * Asks the layout for {@link actions} in order, the new pane taking focus,
 * then dispatches the held `open` of {@link shown}, which puts its window in
 * the focused pane.
 */
export function placeShown(
  context: CommandContext,
  shown: Shown,
  actions: readonly LayoutAction[],
): CommandOutcome {
  for (const action of actions) {
    context.dispatch({ type: 'layout', action });
  }
  if (shown.open !== null) {
    context.dispatchWindows(shown.open);
  }
  return OK;
}

/**
 * The run of a split command: no argument shows the focused window in the
 * new pane (vim's behaviour), otherwise the argument is a view spec. A spec
 * that does not parse echoes {@link usage} (read when it runs, so it follows
 * the language, decision 19); one that parses but cannot open says why, and
 * nothing is split.
 */
export function splitRun(dir: SplitDir, usage: () => string): CommandDefinition['run'] {
  return async (args, context) => {
    const shown = await viewToShow(args, context, usage());
    return shown.ok
      ? placeShown(context, shown.value, [{ type: 'split', dir, windowId: shown.value.windowId }])
      : fail(shown.error);
  };
}
