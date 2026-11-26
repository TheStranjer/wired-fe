/**
 * The views a pane's split buttons offer (WFE-229, decisions 12 and 13): one
 * list, built from the commands the backend can run and the reader's saved
 * feeds, shared by `◫▾` (`/vsplit`), `⊟▾` (`/split`), the empty desktop
 * (`/vsplit`, WFE-298) and the start menu (`/float`, WFE-299). Pure. A row whose
 * command is missing is left out, so no menu offers what a line would refuse.
 * A row either runs at once, asks for its argument in a small dialog (the
 * `…` rows that need typed text, WFE-269), or opens a picker of the open
 * windows (`Existing window…`, WFE-270). No row fills the command line. The
 * last row, `Attach media…` (WFE-288), is no view: it only runs `/attach`,
 * which opens the file dialog and opens no pane, and sits apart below the views.
 * The fixed rows are in ./paneMenuRows; every text is worded in the language
 * in use by the `t` the builder is given (decision 19).
 */

import { askedArgument } from './paneAsk';
import type { PaneAsk } from './paneAsk';
import { headRows, tailRows } from './paneMenuRows';
import type { Row } from './paneMenuRows';
import type { Registry } from '../commands/types';
import type { Translate } from '../i18n/messages';
import type { Feeds } from '../state/feeds';
import type { MenuItem } from '../ui/MenuButton';

/** One row of the menu, with what choosing it runs. */
export type PaneMenuEntry = MenuItem & {
  /** The view spec after `/vsplit`, or the whole line when {@link literal}. */
  readonly text: string;
  /** Whether {@link text} is a whole command line rather than a view spec. */
  readonly literal: boolean;
  /** `'window'` swaps the menu for a list of the open windows; null for any other row. */
  readonly pick: 'window' | null;
  /** Set for a row that asks for an argument in a dialog, then runs `text` with it. */
  readonly ask: PaneAsk | null;
};

/** The entry for {@link row}: a view spec, or a whole line when the view starts with a slash (`/people` opens its own split). */
function viewEntry(row: Row): PaneMenuEntry {
  const literal = row.view.startsWith('/');
  return {
    id: row.id,
    label: row.label,
    text: row.view,
    literal,
    pick: row.pick,
    ask: row.ask,
  };
}

/** The rows of {@link rows} whose command the registry has. */
function offered(registry: Registry, rows: readonly Row[]): readonly PaneMenuEntry[] {
  return rows.filter((row) => row.needs === null || registry.byName.has(row.needs)).map(viewEntry);
}

/** One row per saved feed, then `New feed…`; none without the `/feed` command. */
function feedEntries(registry: Registry, feeds: Feeds, t: Translate): readonly PaneMenuEntry[] {
  if (!registry.byName.has('feed')) {
    return [];
  }
  const saved = feeds.map((feed): PaneMenuEntry => ({
    id: `feed:${feed.id}`,
    label: t('app.menu_feed', { name: feed.name }),
    text: `feed ${feed.name}`,
    literal: false,
    pick: null,
    ask: null,
  }));
  const created: PaneMenuEntry = {
    id: 'feed-new',
    label: t('app.menu_new_feed'),
    text: '/feed new',
    literal: true,
    pick: null,
    ask: null,
  };
  return [...saved, created];
}

/** The `Attach media…` row, set apart from the views: it runs `/attach` and opens no pane; none without the command. */
function attachEntries(registry: Registry, t: Translate): readonly PaneMenuEntry[] {
  if (!registry.byName.has('attach')) {
    return [];
  }
  return [
    {
      id: 'attach',
      label: t('app.attach_media'),
      text: '/attach',
      literal: true,
      pick: null,
      ask: null,
      separated: true,
    },
  ];
}

/** The menu's rows for the commands in {@link registry} and the saved {@link feeds}, top to bottom, worded by {@link t}. */
export function paneMenuEntries(
  registry: Registry,
  feeds: Feeds,
  t: Translate,
): readonly PaneMenuEntry[] {
  return [
    ...offered(registry, headRows(t)),
    ...feedEntries(registry, feeds, t),
    ...offered(registry, tailRows(t)),
    ...attachEntries(registry, t),
  ];
}

/** The commands that share the view list: the two splits (the pane menus), `vsplit` (the empty desktop) and `float` (the start menu). */
export type ViewCommand = 'vsplit' | 'split' | 'float';

/** The command line {@link entry} runs or fills when chosen from the `/`{@link command} button. */
export function entryLine(entry: PaneMenuEntry, command: ViewCommand): string {
  return entry.literal ? entry.text : `/${command} ${entry.text}`.trim();
}

/** The command line {@link entry} runs from the `/`{@link command} button once its dialog was answered with {@link answer}. */
export function askedLine(entry: PaneMenuEntry, command: ViewCommand, answer: string): string {
  const argument = askedArgument(entry.ask?.suggest ?? null, answer);
  return `${entryLine(entry, command)} ${argument}`;
}
