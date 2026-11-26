/**
 * The composer window's content (decision 13): the shared form
 * (src/views/ComposerForm), over the draft the app state keeps for this window,
 * with a "Post as" picker above it, the window's attachments under the text
 * (src/views/MediaLines, WFE-205) and the window's client messages — the confirmation
 * after a send — in the scrollback below. The window's account sets the limit
 * and the audiences offered; picking another account moves the window to it,
 * and an audience that account's instance does not serve (`local` on Mastodon)
 * falls back to the reader's default; an open poll is fitted to the new
 * instance's poll limits (WFE-206). Attachments belong to the account that
 * uploaded them, so picking another account takes them off the draft. Files
 * pasted or dropped onto the pane attach to this composer alone. A reply
 * composer (WFE-244) is bound to the post it answers and a quote composer
 * (WFE-262) to the post it quotes: the picker gives way to the dim excerpt of
 * that post (./ComposerHeader), since the post goes out as the account of the
 * line it came from. An edit composer (WFE-268) is bound to the post it
 * rewrites the same way, its audience locked, and offers neither attachments
 * nor a poll, since the edit keeps the post's own.
 */

import type { JSX } from 'react';

import { ComposerHeader } from './ComposerHeader';
import styles from './ComposerWindow.module.css';
import { useAccountPick } from './useAccountPick';
import { useComposerSend } from './useComposerSend';
import { composerLimits } from '../../state/composerActions';
import { mediaIdsOf } from '../../state/composerMedia';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import { BufferView } from '../../views/BufferView';
import { ComposerForm } from '../../views/ComposerForm';
import { MediaLines } from '../../views/MediaLines';
import { useComposerMedia } from '../../views/useComposerMedia';
import { usePaneDrop } from '../../views/usePaneDrop';

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
  const editing = fields.editing !== undefined;

  return (
    <div className={[styles['window'], dragging ? styles['dropping'] : ''].join(' ')} {...drop}>
      <ComposerForm
        allowLocal={limits.allowLocal}
        attachments={
          editing ? null : (
            <MediaLines
              items={media.items}
              onDescribe={media.describe}
              onFiles={media.add}
              onRemove={media.remove}
            />
          )
        }
        error={error}
        fields={{ ...fields, mediaIds: [...(fields.mediaIds ?? []), ...mediaIdsOf(media.items)] }}
        header={
          <ComposerHeader
            accountKey={accountKey}
            fields={fields}
            onPick={pick}
            accounts={state.accounts}
          />
        }
        maxCharacters={limits.maxCharacters}
        onChange={(patch) => {
          dispatch({ type: 'composerEdit', windowId, patch });
        }}
        onSend={send}
        {...(editing ? {} : { pollLimits: limits.pollLimits })}
        sending={sending}
      />
      <BufferView label={win?.title ?? 'compose'} windowId={windowId} />
    </div>
  );
}
