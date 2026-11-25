/**
 * How the composer window sends (decision 13): the draft goes out as the
 * window's account through the same create every postable window uses
 * (src/state/postStatus), but a pane is persistent, so success clears the
 * fields and keeps the window, and says so in the window's own scrollback; a
 * failure stays inside the form for the retry.
 */

import { useState } from 'react';

import { printAction } from '../../state/appState';
import { composerFields } from '../../state/composerActions';
import { type ComposerFields, fieldsToDraft } from '../../state/draft';
import { createPost } from '../../state/postStatus';
import { useRefreshDeps } from '../../state/RefreshContext';
import { useAppDispatch, useAppState } from '../../state/StateContext';

/** What the form needs of a send: whether one is in flight, its failure, and the trigger. */
export type ComposerSend = {
  readonly fields: ComposerFields;
  readonly sending: boolean;
  readonly error: string | null;
  readonly send: () => void;
};

/** The sending state of window {@link windowId}'s composer, and its trigger. */
export function useComposerSend(windowId: string, accountKey: string | null): ComposerSend {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = composerFields(state, windowId);

  async function submit(): Promise<void> {
    setSending(true);
    const created = await createPost(
      { state, dispatch, refresh },
      accountKey,
      fieldsToDraft(fields),
    );
    setSending(false);
    if (!created.ok) {
      setError(created.error);
      return;
    }
    setError(null);
    dispatch({ type: 'composerEdit', windowId, patch: { text: '', spoiler: '' } });
    dispatch(printAction(windowId, 'info', `Posted as @${created.value.account.acct}`));
  }

  return {
    fields,
    sending,
    error,
    send: () => {
      void submit();
    },
  };
}
