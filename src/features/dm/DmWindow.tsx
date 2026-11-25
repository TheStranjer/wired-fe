/**
 * The DM window's content (WFE-108, WFE-207): the conversation's messages in
 * the scrolling log region the window's title names, filled once by
 * ./useDirect, with the input box (./DmInput) docked under it, outside the
 * scrolling area. A window that is not on the list has nobody to answer, so it
 * shows the empty log alone.
 */

import type { JSX } from 'react';

import { DmInput } from './DmInput';
import styles from './DmWindow.module.css';
import { useDirect } from './useDirect';
import { useAppState } from '../../state/StateContext';
import { BufferView } from '../../views/BufferView';

/** The DM window {@link windowId}: its messages over its docked input. */
export function DmWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  useDirect(windowId);
  const win = useAppState().windows.windows.find((candidate) => candidate.id === windowId);
  if (win === undefined) {
    return <BufferView windowId={windowId} label="dm" />;
  }
  return (
    <div className={styles['window']}>
      <BufferView windowId={windowId} label={win.title} />
      <div className={styles['input']}>
        <DmInput win={win} />
      </div>
    </div>
  );
}
