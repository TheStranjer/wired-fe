/**
 * What the buffers have shown, as completion words (WFE-124, WFE-300): every
 * account a status or notification names, with the display name when the
 * line carried one, and every tag a status carries. The providers of
 * ./completionProviders filter and describe these.
 */

import type { Account } from '../api/schemas/account';
import type { Status } from '../api/schemas/status';
import type { AppState } from '../state/appState';
import type { LineData } from '../state/buffer';

/** What a handle word is written with. */
export const HANDLE_PREFIX = '@';

/** What a tag word is written with. */
export const TAG_PREFIX = '#';

/** One completion word with the name it is described by; empty when it has none. */
export type NamedWord = {
  readonly word: string;
  readonly name: string;
};

/** The word completion writes for {@link account}, named by its display name. */
export function handleOf(account: Account): NamedWord {
  return { word: `${HANDLE_PREFIX}${account.acct}`, name: account.display_name };
}

/** Every account a status names: its author (with its display name), its
 * mentions, and the same for the reblog it boosts and the quote it carries. */
function statusHandles(status: Status): NamedWord[] {
  const handles = [
    handleOf(status.account),
    ...status.mentions.map((mention) => ({ word: `${HANDLE_PREFIX}${mention.acct}`, name: '' })),
  ];
  if (status.reblog !== null) {
    handles.push(...statusHandles(status.reblog));
  }
  if (status.quote !== null) {
    handles.push(...statusHandles(status.quote));
  }
  return handles;
}

/** Every account one scrollback line names. */
function lineHandles(line: LineData): readonly NamedWord[] {
  if (line.kind === 'post') {
    return statusHandles(line.status);
  }
  if (line.kind === 'notification') {
    const { account, status } = line.notification;
    const named = [handleOf(account)];
    if (status !== null) {
      named.push(...statusHandles(status));
    }
    return named;
  }
  return [];
}

/** Every handle the buffers have shown, plus the signed-in accounts' own. */
export function seenHandles(state: AppState): NamedWord[] {
  const handles = state.accounts.map((account) => ({
    word: `${HANDLE_PREFIX}${account.handle}`,
    name: '',
  }));
  for (const buffer of state.buffers.values()) {
    for (const line of buffer.lines) {
      handles.push(...lineHandles(line));
    }
  }
  return handles;
}

/** Every tag a status carries, and the same for its reblog and its quote. */
function statusTags(status: Status): string[] {
  const tags = status.tags.map((tag) => `${TAG_PREFIX}${tag.name}`);
  if (status.reblog !== null) {
    tags.push(...statusTags(status.reblog));
  }
  if (status.quote !== null) {
    tags.push(...statusTags(status.quote));
  }
  return tags;
}

/** Every tag one scrollback line carries. */
function lineTags(line: LineData): readonly string[] {
  if (line.kind === 'post') {
    return statusTags(line.status);
  }
  if (line.kind === 'notification') {
    return line.notification.status === null ? [] : statusTags(line.notification.status);
  }
  return [];
}

/** Every tag the buffers have shown. */
export function seenTags(state: AppState): string[] {
  const tags: string[] = [];
  for (const buffer of state.buffers.values()) {
    for (const line of buffer.lines) {
      tags.push(...lineTags(line));
    }
  }
  return tags;
}
