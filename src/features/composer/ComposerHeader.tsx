/**
 * What sits above a composer's text: the "Post as" picker for a plain draft,
 * or the dim excerpt of the post a bound composer answers (./ReplyingTo,
 * WFE-244) or quotes (./QuotingPost, WFE-262) — those post as the account of
 * the line they came from, so they have no picker.
 */

import type { JSX } from 'react';

import { PostAs } from './PostAs';
import { QuotingPost } from './QuotingPost';
import { ReplyingTo } from './ReplyingTo';
import type { StoredAccount } from '../../accounts/accountStore';
import type { ComposerFields } from '../../state/draft';

/** What the header needs: the draft's bindings and the picker's inputs. */
type ComposerHeaderProps = {
  readonly fields: ComposerFields;
  readonly accounts: readonly StoredAccount[];
  readonly accountKey: string | null;
  readonly onPick: (accountKey: string) => void;
};

/** The picker, the replied-to excerpt or the quoted excerpt, whichever the draft calls for. */
export function ComposerHeader(props: ComposerHeaderProps): JSX.Element {
  const { fields } = props;
  if (fields.inReplyTo !== undefined) {
    return <ReplyingTo status={fields.inReplyTo.status} />;
  }
  if (fields.quoteOf !== undefined) {
    return <QuotingPost status={fields.quoteOf.status} />;
  }
  return <PostAs accounts={props.accounts} onPick={props.onPick} value={props.accountKey} />;
}
