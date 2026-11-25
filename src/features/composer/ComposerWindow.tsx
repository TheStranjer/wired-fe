/**
 * The composer window's content (decision 13): the same form the overlay shows
 * (src/views/ComposerForm), over the draft the app state keeps for this window,
 * with a "Post as" picker above it and the window's client messages — the
 * confirmation after a send — in the scrollback below. The window's account
 * sets the limit and the audiences offered; picking another account moves the
 * window to it, and an audience that account's instance does not serve (`local`
 * on Mastodon) falls back to the reader's default.
 */

import type { JSX } from 'react';

import styles from './ComposerWindow.module.css';
import { PostAs } from './PostAs';
import { useComposerSend } from './useComposerSend';
import { composerLimits } from '../../state/composerActions';
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

  function pick(key: string): void {
    const next = composerLimits(state, key);
    dispatch({ type: 'windows', action: { type: 'setAccount', id: windowId, accountKey: key } });
    if (fields.visibility === 'local' && !next.allowLocal) {
      dispatch({
        type: 'composerEdit',
        windowId,
        patch: { visibility: state.settings.defaultVisibility },
      });
    }
  }

  return (
    <div className={styles['window']}>
      <ComposerForm
        allowLocal={limits.allowLocal}
        error={error}
        fields={fields}
        header={<PostAs accounts={state.accounts} onPick={pick} value={accountKey} />}
        maxCharacters={limits.maxCharacters}
        onChange={(patch) => {
          dispatch({ type: 'composerEdit', windowId, patch });
        }}
        onSend={send}
        sending={sending}
      />
      <BufferView label={win?.title ?? 'compose'} windowId={windowId} />
    </div>
  );
}
