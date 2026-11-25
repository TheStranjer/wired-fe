/**
 * The views a pane's split buttons offer (WFE-229, decisions 12 and 13): one
 * list, built from the commands the backend can run and the reader's saved
 * feeds, shared by `┃▾` (`/vsplit`) and `━▾` (`/split`). Pure. A row whose
 * command is missing is left out, so no menu offers what a line would refuse.
 * A row either runs at once, asks for its argument in a small dialog (the
 * `…` rows but the last, WFE-269), or only fills the command line for the user
 * to finish (`Existing window…`, through the same prefill the hotkeys use).
 */

import type { Registry } from '../commands/types';
import type { Feeds } from '../state/feeds';
import type { MenuItem } from '../ui/MenuButton';

/** What a row that needs one argument asks for, in a dialog, before it runs. */
export type PaneAsk = {
  /** The dialog's title, e.g. `Open profile`. */
  readonly title: string;
  /** What the empty field hints at. */
  readonly placeholder: string;
  /** Which completion words the field suggests, and how its answer is cleaned up; null for plain text. */
  readonly suggest: 'accounts' | 'tags' | null;
};

/** One row of the menu, with what choosing it runs. */
export type PaneMenuEntry = MenuItem & {
  /** The view spec after `/vsplit`, or the whole line when {@link literal}. */
  readonly text: string;
  /** Whether {@link text} is a whole command line rather than a view spec. */
  readonly literal: boolean;
  /** True fills the line into the command line instead of running it. */
  readonly prefill: boolean;
  /** Set for a row that asks for an argument in a dialog, then runs `text` with it. */
  readonly ask: PaneAsk | null;
};

/** A row of the fixed part of the menu: the command it needs and the view it opens. */
type Row = {
  readonly id: string;
  readonly label: string;
  /** The command the view needs; null for a row that needs none. */
  readonly needs: string | null;
  readonly view: string;
  readonly prefill: boolean;
  readonly ask: PaneAsk | null;
};

/** A row that runs `view` at once. */
function plain(id: string, label: string, view = id): Row {
  return { id, label, needs: id, view, prefill: false, ask: null };
}

/** A row whose view is finished by the answer to {@link ask}. */
function asking(row: Pick<Row, 'id' | 'label' | 'needs' | 'ask'>): Row {
  return { ...row, view: row.id, prefill: false };
}

/** The rows before the saved feeds. */
const HEAD: readonly Row[] = [
  { id: 'same', label: 'Same window', needs: null, view: '', prefill: false, ask: null },
];

/** The rows after the saved feeds. */
const TAIL: readonly Row[] = [
  plain('composer', 'Composer'),
  plain('home', 'Home'),
  plain('notifications', 'Notifications'),
  plain('local', 'Local'),
  plain('federated', 'Federated'),
  plain('dms', 'Direct messages'),
  plain('people', 'People here', '/people'),
  asking({
    id: 'tag',
    label: 'Hashtag…',
    needs: 'tag',
    ask: { title: 'Split with hashtag', placeholder: '#tag', suggest: 'tags' },
  }),
  asking({
    id: 'search',
    label: 'Search…',
    needs: 'search',
    ask: { title: 'Search', placeholder: 'words, @account or #tag', suggest: null },
  }),
  asking({
    id: 'whois',
    label: 'Profile…',
    needs: 'whois',
    ask: { title: 'Open profile', placeholder: '@user@instance', suggest: 'accounts' },
  }),
  asking({
    id: 'dm',
    label: 'DM…',
    needs: 'query',
    ask: { title: 'Direct message', placeholder: '@user@instance', suggest: 'accounts' },
  }),
  { id: 'win', label: 'Existing window…', needs: 'win', view: 'win', prefill: true, ask: null },
];

/** The entry for {@link row}: a view spec, or a whole line when the view starts with a slash (`/people` opens its own split). */
function viewEntry(row: Row): PaneMenuEntry {
  const literal = row.view.startsWith('/');
  return {
    id: row.id,
    label: row.label,
    text: row.view,
    literal,
    prefill: row.prefill,
    ask: row.ask,
  };
}

/** The rows of {@link rows} whose command the registry has. */
function offered(registry: Registry, rows: readonly Row[]): readonly PaneMenuEntry[] {
  return rows.filter((row) => row.needs === null || registry.byName.has(row.needs)).map(viewEntry);
}

/** One row per saved feed, then `New feed…`; none without the `/feed` command. */
function feedEntries(registry: Registry, feeds: Feeds): readonly PaneMenuEntry[] {
  if (!registry.byName.has('feed')) {
    return [];
  }
  const saved = feeds.map((feed): PaneMenuEntry => ({
    id: `feed:${feed.id}`,
    label: `Feed: ${feed.name}`,
    text: `feed ${feed.name}`,
    literal: false,
    prefill: false,
    ask: null,
  }));
  const created: PaneMenuEntry = {
    id: 'feed-new',
    label: 'New feed…',
    text: '/feed new',
    literal: true,
    prefill: false,
    ask: null,
  };
  return [...saved, created];
}

/** The menu's rows for the commands in {@link registry} and the saved {@link feeds}, top to bottom. */
export function paneMenuEntries(registry: Registry, feeds: Feeds): readonly PaneMenuEntry[] {
  return [...offered(registry, HEAD), ...feedEntries(registry, feeds), ...offered(registry, TAIL)];
}

/** The commands whose menus share the view list: the two splits and the pop-out. */
export type ViewCommand = 'vsplit' | 'split' | 'float';

/** The pop-out menu's first row: float the pane itself (`/float`). */
const THIS_PANE: PaneMenuEntry = {
  id: 'this',
  label: 'This pane',
  text: '',
  literal: false,
  prefill: false,
  ask: null,
};

/** The rows of the pop-out menu: `This pane`, then {@link entries} less `Same window`, which `This pane` replaces. */
export function popOutEntries(entries: readonly PaneMenuEntry[]): readonly PaneMenuEntry[] {
  return [THIS_PANE, ...entries.filter((entry) => entry.id !== 'same')];
}

/** The command line {@link entry} runs or fills when chosen from the `/`{@link command} button. */
export function entryLine(entry: PaneMenuEntry, command: ViewCommand): string {
  return entry.literal ? entry.text : `/${command} ${entry.text}`.trim();
}

/** {@link answer} as the argument of an `ask` row: no `#` before a tag, an `@` before an account. */
function askedArgument(suggest: PaneAsk['suggest'], answer: string): string {
  const typed = answer.trim();
  switch (suggest) {
    case 'tags':
      return typed.replace(/^#/u, '');
    case 'accounts':
      return typed.startsWith('@') ? typed : `@${typed}`;
    case null:
      return typed;
  }
}

/** The command line {@link entry} runs from the `/`{@link command} button once its dialog was answered with {@link answer}. */
export function askedLine(entry: PaneMenuEntry, command: ViewCommand, answer: string): string {
  const argument = askedArgument(entry.ask?.suggest ?? null, answer);
  return `${entryLine(entry, command)} ${argument}`;
}
