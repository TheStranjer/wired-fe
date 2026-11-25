/**
 * The views a pane's split buttons offer (WFE-229, decisions 12 and 13): one
 * list, built from the commands the backend can run and the reader's saved
 * feeds, shared by `┃▾` (`/vsplit`) and `━▾` (`/split`). Pure. A row whose
 * command is missing is left out, so no menu offers what a line would refuse.
 * A row runs at once, only fills the command line for the user to finish (the
 * `…` rows that need typed text), through the same prefill the hotkeys use, or
 * opens a picker of the open windows (`Existing window…`, WFE-270).
 */

import type { Registry } from '../commands/types';
import type { Feeds } from '../state/feeds';
import type { MenuItem } from '../ui/MenuButton';

/** One row of the menu, with what choosing it runs. */
export type PaneMenuEntry = MenuItem & {
  /** The view spec after `/vsplit`, or the whole line when {@link literal}. */
  readonly text: string;
  /** Whether {@link text} is a whole command line rather than a view spec. */
  readonly literal: boolean;
  /** True fills the line into the command line instead of running it. */
  readonly prefill: boolean;
  /** `'window'` swaps the menu for a list of the open windows; null for any other row. */
  readonly pick: 'window' | null;
};

/** A row of the fixed part of the menu: the command it needs and the view it opens. */
type Row = {
  readonly id: string;
  readonly label: string;
  /** The command the view needs; null for a row that needs none. */
  readonly needs: string | null;
  readonly view: string;
  readonly prefill: boolean;
  readonly pick: 'window' | null;
};

/** A row that runs its view at once, and needs the command of its own name. */
function run(id: string, label: string, view: string): Row {
  return { id, label, needs: id, view, prefill: false, pick: null };
}

/** A row that fills `/vsplit <view>` for the user to finish, and needs the command of its own name. */
function fill(id: string, label: string, view: string): Row {
  return { id, label, needs: id, view, prefill: true, pick: null };
}

/** The rows before the saved feeds. */
const HEAD: readonly Row[] = [
  { id: 'same', label: 'Same window', needs: null, view: '', prefill: false, pick: null },
];

/** The rows after the saved feeds. */
const TAIL: readonly Row[] = [
  run('composer', 'Composer', 'composer'),
  run('home', 'Home', 'home'),
  run('notifications', 'Notifications', 'notifications'),
  run('local', 'Local', 'local'),
  run('federated', 'Federated', 'federated'),
  run('dms', 'Direct messages', 'dms'),
  run('people', 'People here', '/people'),
  fill('tag', 'Hashtag…', 'tag'),
  fill('search', 'Search…', 'search'),
  fill('whois', 'Profile…', 'whois @'),
  { ...fill('dm', 'DM…', 'dm @'), needs: 'query' },
  {
    id: 'win',
    label: 'Existing window…',
    needs: 'win',
    view: 'win',
    prefill: false,
    pick: 'window',
  },
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
    pick: row.pick,
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
    pick: null,
  }));
  const created: PaneMenuEntry = {
    id: 'feed-new',
    label: 'New feed…',
    text: '/feed new',
    literal: true,
    prefill: false,
    pick: null,
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
  pick: null,
};

/** The rows of the pop-out menu: `This pane`, then {@link entries} less `Same window`, which `This pane` replaces. */
export function popOutEntries(entries: readonly PaneMenuEntry[]): readonly PaneMenuEntry[] {
  return [THIS_PANE, ...entries.filter((entry) => entry.id !== 'same')];
}

/** The command line {@link entry} runs or fills when chosen from the `/`{@link command} button. */
export function entryLine(entry: PaneMenuEntry, command: ViewCommand): string {
  return entry.literal ? entry.text : `/${command} ${entry.text}`.trim();
}
