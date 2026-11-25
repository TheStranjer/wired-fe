/**
 * What saving a feed editor means, as the `/feed` command lines (decision 6):
 * the editor does nothing the command line cannot, so saving runs these lines
 * and command, click and settings stay one path. A new feed is one `/feed
 * new`; a saved one gets a `/feed rm` for what was unticked, a `/feed add`
 * for what was ticked and a `/feed rename` for a new name, in that order, so
 * every line names the feed as the lines before it left it.
 */

import type { EditorDraft } from './editorDraft';
import type { StoredAccount } from '../../accounts/accountStore';
import { type FeedSourceRef, type FeedSpec, sameRef } from '../../state/feeds';

/** The part of a signed-in account the lines need. */
type LineAccount = Pick<StoredAccount, 'key' | 'handle'>;

/** The source words of {@link refs} as the command grammar writes them; a signed-out account's are left out. */
function sourceWords(
  refs: readonly FeedSourceRef[],
  accounts: readonly LineAccount[],
): readonly string[] {
  return refs.flatMap((ref) => {
    const account = accounts.find((one) => one.key === ref.accountKey);
    return account === undefined ? [] : [`@${account.handle}:${ref.source}`];
  });
}

/** The sources of {@link from} that {@link other} does not read. */
function missingFrom(
  from: readonly FeedSourceRef[],
  other: readonly FeedSourceRef[],
): readonly FeedSourceRef[] {
  return from.filter((ref) => !other.some((one) => sameRef(one, ref)));
}

/** The lines that change the saved {@link feed} into {@link draft}; none when nothing changed. */
function changeLines(
  feed: FeedSpec,
  draft: EditorDraft,
  accounts: readonly LineAccount[],
): readonly string[] {
  const removed = sourceWords(missingFrom(feed.sources, draft.sources), accounts);
  const added = sourceWords(missingFrom(draft.sources, feed.sources), accounts);
  const name = draft.name.trim();
  return [
    ...(removed.length > 0 ? [`/feed rm ${feed.name} ${removed.join(' ')}`] : []),
    ...(added.length > 0 ? [`/feed add ${feed.name} ${added.join(' ')}`] : []),
    ...(name === feed.name ? [] : [`/feed rename ${feed.name} ${name}`]),
  ];
}

/**
 * The `/feed` lines that save {@link draft} over {@link feed} — a new feed
 * when it is null — as seen by {@link accounts}.
 */
export function saveLines(
  feed: FeedSpec | null,
  draft: EditorDraft,
  accounts: readonly LineAccount[],
): readonly string[] {
  if (feed === null) {
    return [`/feed new ${[draft.name.trim(), ...sourceWords(draft.sources, accounts)].join(' ')}`];
  }
  return changeLines(feed, draft, accounts);
}
