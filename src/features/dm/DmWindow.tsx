/**
 * The DM window's content (WFE-108, WFE-207): the conversation's messages in
 * the scrolling log region the window's title names, filled once by
 * ./useDirect, with the input box (./DmInput) docked under it, outside the
 * scrolling area (src/views/DockedInput). Files pasted or dropped onto the
 * pane go to the box's own media (WFE-289). A window that is not on the list
 * has nobody to answer, so it shows the empty log alone.
 */

import type { JSX } from 'react';

import { DmInput } from './DmInput';
import { useDirect } from './useDirect';
import { useT } from '../../i18n/I18nProvider';
import { useAppState } from '../../state/StateContext';
import { BufferView } from '../../views/BufferView';
import { DockedInput } from '../../views/DockedInput';
import { useComposerMedia } from '../../views/useComposerMedia';

/** The DM window {@link windowId}: its messages over its docked input. */
export function DmWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  useDirect(windowId);
  const win = useAppState().windows.windows.find((candidate) => candidate.id === windowId);
  const media = useComposerMedia(windowId, win?.ref.accountKey ?? null);
  const logLabel = useT()('features.dm.log_label');
  if (win === undefined) {
    return <BufferView windowId={windowId} label={logLabel} />;
  }
  return (
    <DockedInput input={<DmInput win={win} />} onFiles={media.add}>
      <BufferView windowId={windowId} label={win.title} />
    </DockedInput>
  );
}
