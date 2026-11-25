/**
 * The draft that answers one post (AGENTS.md "The command line is the
 * composer", WFE-104): what typing into a thread window starts from. A reply
 * keeps the audience of the post it answers — direct stays direct, private
 * stays private, unlisted stays unlisted — while a public or local post
 * leaves the reader's own default to decide; it carries the content warning
 * of the post answered, so the answer stays behind the same fold; and it
 * @-mentions the author and everyone the answered post mentions, except the
 * replier themselves and anyone their typed text already names. Pure: the
 * status, the replier's own account handle and the typed text arrive as
 * parameters, so every path that replies builds the same draft. The reply
 * composer's starting fields (WFE-244) are built here too.
 */

import type { ComposerFields, Draft } from './draft';
import type { Status, Visibility } from '../api/schemas/status';

/** The audiences a reply keeps for itself; anything else takes the default. */
const KEPT_VISIBILITY: ReadonlyMap<Visibility, Visibility> = new Map([
  ['direct', 'direct'],
  ['private', 'private'],
  ['unlisted', 'unlisted'],
]);

/** The accts a reply answers: the author first, then every mention. */
function respondentAccts(status: Status): string[] {
  return [status.account.acct, ...status.mentions.map((mention) => mention.acct)];
}

/** The accts the reply must name: not the reader's own, once each, unseen in text. */
function missingAccts(accts: readonly string[], ownAcct: string, text: string): string[] {
  const lowered = text.toLowerCase();
  const own = ownAcct.toLowerCase();
  const seen = new Set<string>();
  return accts.filter((acct) => {
    const key = acct.toLowerCase();
    if (key === own || seen.has(key) || lowered.includes(`@${key}`)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/** {@link text} with `@<acct> ` in front for every respondent {@link missing} names. */
function prefixedText(missing: readonly string[], text: string): string {
  if (missing.length === 0) {
    return text;
  }
  return `${missing.map((acct) => `@${acct}`).join(' ')} ${text}`;
}

/**
 * The {@link Draft} that answers {@link status} with {@link text}: the text
 * prefixed with `@<acct> ` for every respondent the reply must name, the
 * status's id as the answered post, the status's content warning, and the
 * status's audience when it is one a reply keeps — left unset otherwise, so
 * the reader's default fills it (src/state/draft).
 */
export function replyDraft(status: Status, ownAcct: string, text: string): Draft {
  const visibility = KEPT_VISIBILITY.get(status.visibility);
  return {
    text: prefixedText(missingAccts(respondentAccts(status), ownAcct, text), text),
    spoilerText: status.spoiler_text,
    ...(visibility === undefined ? {} : { visibility }),
    inReplyToId: status.id,
  };
}

/** The audiences from widest to narrowest; `local` stays on the instance, so it sits under public. */
const BREADTH: readonly Visibility[] = ['public', 'local', 'unlisted', 'private', 'direct'];

/** The narrower of two audiences: a reply never reaches further than the post or the default. */
function narrower(first: Visibility, second: Visibility): Visibility {
  return BREADTH.indexOf(first) >= BREADTH.indexOf(second) ? first : second;
}

/**
 * The fields of a reply composer bound to {@link status} (WFE-244): the text
 * holds just the `@<acct> ` mentions {@link replyDraft} computes, the content
 * warning is the post's, the audience is the post's capped by
 * {@link defaultVisibility} (never wider than either), and the answered post
 * and the account of its line travel along.
 */
export function replyFields(
  status: Status,
  reply: {
    readonly ownAcct: string;
    readonly accountKey: string | null;
    readonly defaultVisibility: Visibility;
  },
): Pick<ComposerFields, 'text' | 'spoiler' | 'visibility' | 'inReplyTo'> {
  const draft = replyDraft(status, reply.ownAcct, '');
  return {
    text: draft.text,
    spoiler: status.spoiler_text,
    visibility: narrower(status.visibility, reply.defaultVisibility),
    inReplyTo: { status, accountKey: reply.accountKey },
  };
}
