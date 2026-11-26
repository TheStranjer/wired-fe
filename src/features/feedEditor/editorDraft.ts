/**
 * The draft a feed editor edits (decision 14): the name in its box and the
 * sources ticked, kept apart from the saved feed until the reader saves.
 * Pure helpers: start a draft from a feed, tick and untick a source, read an
 * account's tags, add one from what was typed, and say what is wrong with the
 * name. What the draft means is spelled out as `/feed` lines in ./saveLines.
 */

import { t } from '../../i18n/translate';
import { type Result, err, ok } from '../../lib/result';
import {
  type FeedSourceRef,
  type FeedSpec,
  isFeedSource,
  nameProblem,
  sameRef,
} from '../../state/feeds';

/** What the editor holds: a name and the sources ticked. */
export type EditorDraft = {
  readonly name: string;
  readonly sources: readonly FeedSourceRef[];
};

/** The prefix of a hashtag source. */
const TAG_PREFIX = 'tag:';

/** The draft of {@link feed}, or an empty one for a feed not made yet (null). */
export function draftOf(feed: FeedSpec | null): EditorDraft {
  return feed === null ? { name: '', sources: [] } : { name: feed.name, sources: feed.sources };
}

/** Whether {@link draft} reads the source {@link ref}. */
export function hasSource(draft: EditorDraft, ref: FeedSourceRef): boolean {
  return draft.sources.some((other) => sameRef(other, ref));
}

/** {@link draft} with {@link ref} ticked, or unticked when it was. */
export function toggleSource(draft: EditorDraft, ref: FeedSourceRef): EditorDraft {
  const sources = hasSource(draft, ref)
    ? draft.sources.filter((other) => !sameRef(other, ref))
    : [...draft.sources, ref];
  return { ...draft, sources };
}

/** The names of the hashtags {@link draft} reads as the account {@link accountKey}. */
export function tagsOf(draft: EditorDraft, accountKey: string): readonly string[] {
  return draft.sources
    .filter((ref) => ref.accountKey === accountKey && ref.source.startsWith(TAG_PREFIX))
    .map((ref) => ref.source.slice(TAG_PREFIX.length));
}

/** {@link draft} also reading the hashtag {@link text} (a leading `#` is allowed) as the account, or why it is not a tag. */
export function withTag(
  draft: EditorDraft,
  accountKey: string,
  text: string,
): Result<EditorDraft, string> {
  const source = `${TAG_PREFIX}${text.trim().replace(/^#/u, '')}`;
  if (!isFeedSource(source)) {
    return err(t('features.feed_editor.not_a_tag', { text: text.trim() }));
  }
  const ref = { accountKey, source };
  return ok(hasSource(draft, ref) ? draft : toggleSource(draft, ref));
}

/** Why the draft's name cannot name a feed, or null when it can; the model has the last word. */
export function draftProblem(draft: EditorDraft): string | null {
  return /\s/u.test(draft.name.trim())
    ? t('features.feed_editor.name_has_spaces')
    : nameProblem(draft.name);
}
