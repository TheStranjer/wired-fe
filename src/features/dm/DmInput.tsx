/**
 * The input box docked under a DM window's messages (WFE-207): the compact
 * composer form (src/views/ComposerForm) over a text this component keeps, so
 * answering a conversation does not need the command line. A send is exactly
 * what the command line's plain text does in this window (./directDraft):
 * mentioning the person the window is private with, `direct`, answering the
 * newest direct post — and the posted status lands in the window's scrollback.
 * Success empties the box; a failure shows inside it with the text kept for a
 * retry. Typing here is insert-mode typing: focusing the box leaves navigation
 * mode, the way focusing the command line does.
 */

import { type JSX, useState } from 'react';

import { postDirect } from './directDraft';
import { currentMoment } from '../../lib/time';
import { composerLimits } from '../../state/composerActions';
import { type ComposerFields, fieldsToDraft } from '../../state/draft';
import { useRefreshDeps } from '../../state/RefreshContext';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import { ComposerForm } from '../../views/ComposerForm';
import type { WindowState } from '../../windows/model';

/** What the box holds when nothing is typed: the audience is the window's, never chosen. */
const EMPTY: ComposerFields = { text: '', spoiler: '', visibility: 'direct' };

/** The box of DM window {@link win}. */
export function DmInput({ win }: { readonly win: WindowState }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const [fields, setFields] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setSending(true);
    const failure = await postDirect(fieldsToDraft(fields), win, {
      state,
      dispatch,
      now: currentMoment,
      refresh,
    });
    setSending(false);
    setError(failure);
    if (failure === null) {
      setFields(EMPTY);
    }
  }

  return (
    <ComposerForm
      allowLocal={false}
      compact
      error={error}
      fields={fields}
      maxCharacters={composerLimits(state, win.ref.accountKey).maxCharacters}
      onChange={(patch) => {
        setFields({ ...fields, ...patch });
      }}
      onFocus={() => {
        if (state.mode === 'navigation') {
          dispatch({ type: 'mode', mode: 'insert' });
        }
      }}
      onSend={() => {
        void submit();
      }}
      sending={sending}
    />
  );
}
