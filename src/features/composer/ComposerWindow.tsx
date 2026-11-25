/**
 * The composer window's content (decision 13): the shared form
 * (src/views/ComposerForm), over the draft the app state keeps for this window,
 * with a "Post as" picker above it, the window's attachments under the text
 * (./MediaLines, WFE-205) and the window's client messages — the confirmation
 * after a send — in the scrollback below. The window's account sets the limit
 * and the audiences offered; picking another account moves the window to it,
 * and an audience that account's instance does not serve (`local` on Mastodon)
 * falls back to the reader's default; an open poll is fitted to the new
 * instance's poll limits (WFE-206). Attachments belong to the account that
 * uploaded them, so picking another account takes them off the draft. Files
 * pasted or dropped onto the pane attach to this composer alone. A reply
 * composer (WFE-244) is bound to the post it answers: the picker gives way to
 * the dim excerpt of that post (./ReplyingTo), since the answer is posted as
 * the account of the line it answers.
 */

import type { JSX } from 'react';

import styles from './ComposerWindow.module.css';
import { MediaLines } from './MediaLines';
import { PostAs } from './PostAs';
import { ReplyingTo } from './ReplyingTo';
import { useAccountPick } from './useAccountPick';
import { useComposerMedia } from './useComposerMedia';
import { useComposerSend } from './useComposerSend';
import { usePaneDrop } from './usePaneDrop';
import { composerLimits } from '../../state/composerActions';
import { mediaIdsOf } from '../../state/composerMedia';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import { BufferView } from '../../views/BufferView';
import { ComposerForm } from '../../views/ComposerForm';

/** The composer window: picker, form and confirmations of window {@link windowId}. */
export function ComposerWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const win = state.windows.windows.find((candidate) => candidate.id === windowId);
  const accountKey = win?.ref.accountKey ?? null;
  const limits = composerLimits(state, accountKey);
  const { fields, sending, error, send } = useComposerSend(windowId, accountKey);
  const media = useComposerMedia(windowId, accountKey);
  const { dragging, ...drop } = usePaneDrop(media.add);
  const pick = useAccountPick(windowId, media.items.length > 0);

  return (
    <div className={[styles['window'], dragging ? styles['dropping'] : ''].join(' ')} {...drop}>
      <ComposerForm
        allowLocal={limits.allowLocal}
        attachments={
          <MediaLines
            items={media.items}
            onDescribe={media.describe}
            onFiles={media.add}
            onRemove={media.remove}
          />
        }
        error={error}
        fields={{ ...fields, mediaIds: [...(fields.mediaIds ?? []), ...mediaIdsOf(media.items)] }}
        header={
          fields.inReplyTo === undefined ? (
            <PostAs accounts={state.accounts} onPick={pick} value={accountKey} />
          ) : (
            <ReplyingTo status={fields.inReplyTo.status} />
          )
        }
        maxCharacters={limits.maxCharacters}
        onChange={(patch) => {
          dispatch({ type: 'composerEdit', windowId, patch });
        }}
        onSend={send}
        pollLimits={limits.pollLimits}
        sending={sending}
      />
      <BufferView label={win?.title ?? 'compose'} windowId={windowId} />
    </div>
  );
}
