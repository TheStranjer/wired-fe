/**
 * Which account a feed line came through (decision 14, WFE-226), as the plain
 * {@link Via} data the ui layer draws. Only a feed window whose sources span
 * more than one signed-in account marks its lines; every other window, and a
 * single-account feed, shows nothing. Pure: app state, a window and a line key
 * in, data out.
 */
import { usernameOf } from '../accounts/handle';
import type { AppState } from '../state/appState';
import type { LineData } from '../state/buffer';
import { feedById } from '../state/feeds';
import { accountByKey, bufferFor } from '../state/selectors';
import type { Via } from '../ui/ViaMark';

/** Whether the feed window {@link windowId} merges sources of more than one account. */
function spansAccounts(state: AppState, windowId: string): boolean {
  const ref = state.windows.windows.find((win) => win.id === windowId)?.ref;
  if (ref?.kind !== 'feed') {
    return false;
  }
  const spec = feedById(state.settings.feeds, ref.target ?? '');
  return new Set(spec?.sources.map((source) => source.accountKey)).size > 1;
}

/** The keys of the accounts a feed line was seen by, the acting account first. */
function seenBy(line: LineData | undefined): readonly string[] {
  if (line === undefined || line.kind === 'system') {
    return [];
  }
  return line.seenBy ?? (line.accountKey === null ? [] : [line.accountKey]);
}

/** The handle as short as it can be: the local part when no other signed-in account shares it. */
function shortHandle(state: AppState, handle: string): string {
  const name = usernameOf(handle);
  const same = state.accounts.filter((account) => usernameOf(account.handle) === name);
  return same.length > 1 ? handle : name;
}

/**
 * The marker for line {@link lineKey} of window {@link windowId}: the acting
 * account's short handle, with `+N` when N more accounts saw it, and the full
 * list of them; null when the window is not a multi-account feed or no signed-in
 * account is known for the line.
 */
export function viaFor(state: AppState, windowId: string, lineKey: string): Via | null {
  if (!spansAccounts(state, windowId)) {
    return null;
  }
  const line = bufferFor(state, windowId).lines.find((candidate) => candidate.key === lineKey);
  const handles = seenBy(line).flatMap((key) => accountByKey(state, key)?.handle ?? []);
  const [first] = handles;
  if (first === undefined) {
    return null;
  }
  const more = handles.length > 1 ? ` +${String(handles.length - 1)}` : '';
  return {
    label: `${shortHandle(state, first)}${more}`,
    full: handles.map((handle) => `@${handle}`).join(', '),
  };
}
