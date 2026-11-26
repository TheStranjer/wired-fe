/**
 * The input box docked under a thread window's scrollback (WFE-286): the
 * compact composer form (src/views/ComposerForm) over a text this component
 * keeps, wired to the thread the way ../dm/DmInput is wired to its
 * conversation. Plain text answers the window's target post exactly as the
 * command line's does (./threadReply); a line starting with `/` runs as a
 * command with this thread active (./useThreadSend). The box starts from the
 * answered post's audience and warning (`replyDefaults`), so it shows the real
 * defaults. Success empties the box; a failure or a refusal shows inside it
 * with the text kept. Focusing the box leaves navigation mode and makes the
 * thread the active window. While the target post has not loaded the box is
 * disabled and says so.
 */

import { type JSX, useState } from 'react';

import { replyDefaults } from './threadReply';
import { useThreadSend } from './useThreadSend';
import { composerLimits } from '../../state/composerActions';
import type { ComposerFields } from '../../state/draft';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import { ComposerForm } from '../../views/ComposerForm';
import type { WindowState } from '../../windows/model';

/** What the disabled box holds while its thread loads. */
const WAITING: ComposerFields = { text: '', spoiler: '', visibility: 'public' };

/** The box of thread window {@link win}. */
export function ThreadInput({ win }: { readonly win: WindowState }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { sending, error, send, activate } = useThreadSend(win);
  const defaults = replyDefaults(state, win);
  const [typed, setTyped] = useState<ComposerFields | null>(null);
  const fields = typed ?? defaults ?? WAITING;

  return (
    <ComposerForm
      allowLocal={false}
      compact
      disabled={defaults === null}
      error={error}
      fields={fields}
      maxCharacters={composerLimits(state, win.ref.accountKey).maxCharacters}
      onChange={(patch) => {
        setTyped({ ...fields, ...patch });
      }}
      onFocus={() => {
        if (state.mode === 'navigation') {
          dispatch({ type: 'mode', mode: 'insert' });
        }
        activate();
      }}
      onSend={() => {
        void send(fields).then((sent) => {
          if (sent) {
            setTyped(null);
          }
        });
      }}
      placeholder={defaults === null ? 'Loading thread…' : ''}
      sending={sending}
    />
  );
}
