/**
 * The views a pane's split buttons offer (WFE-229, decisions 12 and 13): one
 * list, built from the commands the backend can run and the reader's saved
 * feeds, shared by `┃▾` (`/vsplit`) and `━▾` (`/split`). Pure. A row whose
 * command is missing is left out, so no menu offers what a line would refuse.
 * A row either runs at once or only fills the command line for the user to
 * finish (the `…` rows), through the same prefill the hotkeys use.
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
};

/** A row of the fixed part of the menu: the command it needs and the view it opens. */
type Row = {
  readonly id: string;
  readonly label: string;
  /** The command the view needs; null for a row that needs none. */
  readonly needs: string | null;
  readonly view: string;
  readonly prefill: boolean;
};

/** The rows before the saved feeds. */
const HEAD: readonly Row[] = [
  { id: 'same', label: 'Same window', needs: null, view: '', prefill: false },
];

/** The rows after the saved feeds. */
const TAIL: readonly Row[] = [
  { id: 'composer', label: 'Composer', needs: 'composer', view: 'composer', prefill: false },
  { id: 'home', label: 'Home', needs: 'home', view: 'home', prefill: false },
  {
    id: 'notifications',
    label: 'Notifications',
    needs: 'notifications',
    view: 'notifications',
    prefill: false,
  },
  { id: 'local', label: 'Local', needs: 'local', view: 'local', prefill: false },
  { id: 'federated', label: 'Federated', needs: 'federated', view: 'federated', prefill: false },
  { id: 'dms', label: 'Direct messages', needs: 'dms', view: 'dms', prefill: false },
  { id: 'people', label: 'People here', needs: 'people', view: '/people', prefill: false },
  { id: 'tag', label: 'Hashtag…', needs: 'tag', view: 'tag', prefill: true },
  { id: 'search', label: 'Search…', needs: 'search', view: 'search', prefill: true },
  { id: 'whois', label: 'Profile…', needs: 'whois', view: 'whois @', prefill: true },
  { id: 'dm', label: 'DM…', needs: 'query', view: 'dm @', prefill: true },
  { id: 'win', label: 'Existing window…', needs: 'win', view: 'win', prefill: true },
];

/** The entry for {@link row}: a view spec, or a whole line when the view starts with a slash (`/people` opens its own split). */
function viewEntry(row: Row): PaneMenuEntry {
  const literal = row.view.startsWith('/');
  return { id: row.id, label: row.label, text: row.view, literal, prefill: row.prefill };
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
  }));
  const created: PaneMenuEntry = {
    id: 'feed-new',
    label: 'New feed…',
    text: '/feed new',
    literal: true,
    prefill: true,
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
};

/** The rows of the pop-out menu: `This pane`, then {@link entries} less `Same window`, which `This pane` replaces. */
export function popOutEntries(entries: readonly PaneMenuEntry[]): readonly PaneMenuEntry[] {
  return [THIS_PANE, ...entries.filter((entry) => entry.id !== 'same')];
}

/** The command line {@link entry} runs or fills when chosen from the `/`{@link command} button. */
export function entryLine(entry: PaneMenuEntry, command: ViewCommand): string {
  return entry.literal ? entry.text : `/${command} ${entry.text}`.trim();
}
