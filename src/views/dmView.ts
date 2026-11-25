/**
 * What a direct post's card needs beyond an ordinary post's (WFE-234): who it
 * names besides its author, and, inside a DM window, how the conversation
 * groups into runs. A message continues the run above it when the same author
 * sent it within five minutes of that one, and a continuation drops its header.
 * Pure: statuses and lines in, plain data out.
 */
import type { Viewer } from './postView';
import type { Status } from '../api/schemas/status';
import type { LineData } from '../state/buffer';
import type { DmRecipient } from '../ui/cardDm';

/** How far apart two messages by one author may be and still share a header. */
const RUN_WINDOW_MS = 5 * 60 * 1000;

/** The status a line speaks for: the original of a boost, else the status itself. */
function shownOf(status: Status): Status {
  return status.reblog ?? status;
}

/** The accounts {@link status} mentions other than its author, `self` for the viewer. */
export function recipientsOf(status: Status, viewer: Viewer): readonly DmRecipient[] {
  const shown = shownOf(status);
  return shown.mentions
    .filter((mention) => mention.id !== shown.account.id)
    .map((mention) => ({ handle: mention.acct, self: mention.id === viewer.accountId }));
}

/** Whether {@link next} follows {@link previous} as the same author's message within the window. */
function continuesRun(previous: Status, next: Status): boolean {
  const before = shownOf(previous);
  const after = shownOf(next);
  const gap = Math.abs(Date.parse(after.created_at) - Date.parse(before.created_at));
  return before.account.id === after.account.id && gap <= RUN_WINDOW_MS;
}

/**
 * Whether the post line under {@link key} continues the run of the line just
 * above it, so its card drops the header. The first line, a line whose
 * neighbour is not a post and an unknown key never continue anything.
 */
export function collapsesHeader(lines: readonly LineData[], key: string): boolean {
  const index = lines.findIndex((line) => line.key === key);
  const line = lines[index];
  const above = lines[index - 1];
  if (line?.kind !== 'post' || above?.kind !== 'post') {
    return false;
  }
  return continuesRun(above.status, line.status);
}
