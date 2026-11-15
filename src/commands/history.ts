/**
 * Command-line history (AGENTS.md "The command line is the composer"): the
 * pure model of the lines already submitted and of the cursor that walks them
 * with ArrowUp/ArrowDown. `entries` is oldest first and at most HISTORY_LIMIT
 * long. `index` points at the entry on display while browsing, or is null
 * when the command line holds the `draft` — the text typed before browsing
 * began, restored whenever the cursor leaves past the newest entry. Nothing
 * is persisted: the history lives exactly as long as the app does.
 */

/** The submitted lines plus where the user stands among them. */
export type History = {
  /** The submitted lines, oldest first, at most HISTORY_LIMIT of them. */
  readonly entries: readonly string[];
  /** The entry on display while browsing; null while the draft is shown. */
  readonly index: number | null;
  /** What the line held when browsing began, restored when it ends. */
  readonly draft: string;
};

/** A history that holds nothing: what the app boots with. */
export const EMPTY_HISTORY: History = { entries: [], index: null, draft: '' };

/** The most lines the history remembers. */
export const HISTORY_LIMIT = 100;

/** The entry at {@link index}, or {@link fallback} when the index is out of range. */
function entryAt(entries: readonly string[], index: number, fallback: string): string {
  return entries[index] ?? fallback;
}

/**
 * Record one submitted line: it joins the history and browsing ends at the
 * draft. Blank lines and exact repeats of the newest entry are never recorded,
 * so the history stays a record of distinct things said; ending browsing still
 * happens, so resubmitting a recalled line leaves the cursor at the draft.
 */
export function pushHistory(history: History, line: string): History {
  const last = history.entries[history.entries.length - 1];
  if (line.trim() === '' || line === last) {
    return { entries: history.entries, index: null, draft: '' };
  }
  const entries = [...history.entries, line].slice(-HISTORY_LIMIT);
  return { entries, index: null, draft: '' };
}

/**
 * ArrowUp: one line older. The first press stores {@link current} as the
 * draft and recalls the newest entry; later presses walk further back. At the
 * oldest entry there is nothing older: it stays on display. With nothing ever
 * submitted the line keeps what it holds.
 */
export function historyUp(history: History, current: string): [History, string] {
  if (history.entries.length === 0) {
    return [history, current];
  }
  if (history.index === null) {
    const index = history.entries.length - 1;
    return [{ ...history, index, draft: current }, entryAt(history.entries, index, current)];
  }
  const index = Math.max(history.index - 1, 0);
  return [{ ...history, index }, entryAt(history.entries, index, current)];
}

/**
 * ArrowDown: one line newer, back toward the newest entry and, past it, to
 * the draft with browsing ended. Already at the draft: the line keeps showing
 * it and the history does not move.
 */
export function historyDown(history: History): [History, string] {
  if (history.index === null) {
    return [history, history.draft];
  }
  const index = history.index + 1;
  if (index >= history.entries.length) {
    return [{ ...history, index: null }, history.draft];
  }
  return [{ ...history, index }, entryAt(history.entries, index, history.draft)];
}
