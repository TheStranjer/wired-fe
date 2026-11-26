/**
 * The input box docked under a DM window's messages (WFE-207): the compact
 * composer form (src/views/ComposerForm) over a text this component keeps, so
 * answering a conversation does not need the command line. A send is exactly
 * what the command line's plain text does in this window (./directDraft):
 * mentioning the person the window is private with, `direct`, answering the
 * newest direct post — and the posted status lands in the window's scrollback.
 * The box has its own media (WFE-289): `[📎]` and the rows under the text
 * (src/views/MediaLines) hold files apart from the command line's pending
 * media and every other box's, and a send carries them (./useDirectSend).
 * Success empties the box and its media; a failure shows inside it with the
 * text and the media kept for a retry. Typing here is insert-mode typing:
 * focusing the box leaves navigation mode, the way focusing the command line
 * does.
 */

import { type JSX, useState } from 'react';

import { useDirectCompletion } from './useDirectCompletion';
import { useDirectSend } from './useDirectSend';
import { composerLimits } from '../../state/composerActions';
import type { ComposerFields } from '../../state/draft';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import { ComposerForm } from '../../views/ComposerForm';
import { MediaLines } from '../../views/MediaLines';
import { useComposerMedia } from '../../views/useComposerMedia';
import type { WindowState } from '../../windows/model';

/** What the box holds when nothing is typed: the audience is the window's, never chosen. */
const EMPTY: ComposerFields = { text: '', spoiler: '', visibility: 'direct' };

/** The box of DM window {@link win}. */
export function DmInput({ win }: { readonly win: WindowState }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const media = useComposerMedia(win.id, win.ref.accountKey);
  const { sending, error, send } = useDirectSend(win, media.items);
  const [fields, setFields] = useState(EMPTY);
  const completion = useDirectCompletion(win, fields, setFields);

  return (
    <ComposerForm
      allowLocal={false}
      attachments={
        <MediaLines
          compact
          items={media.items}
          onDescribe={media.describe}
          onFiles={media.add}
          onRemove={media.remove}
        />
      }
      compact
      completion={completion}
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
        void send(fields).then((sent) => {
          if (sent) {
            setFields(EMPTY);
          }
        });
      }}
      sending={sending}
    />
  );
}
