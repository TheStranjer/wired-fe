/**
 * One window's scrollback as its buffer holds it (AGENTS.md "Layout": src/views
 * is the rendering shared by every window): every line of the window's own
 * buffer, oldest first, each keyed by the stable key the buffer gave it so a
 * line that stays on screen keeps its DOM. An unknown window reads as the empty
 * buffer, so a window that has just closed renders nothing rather than throwing.
 */
import type { JSX } from 'react';

import { LineView } from './LineView';
import { bufferFor } from '../state/selectors';
import { useAppState } from '../state/StateContext';
import { Scrollback } from '../ui/Scrollback';

/** Props of {@link BufferView}: the window to show and the region's name. */
type BufferViewProps = {
  readonly windowId: string;
  /** Accessible name of the log region, e.g. "home timeline". */
  readonly label: string;
};

/** The scrollback of one window: its buffer's lines, oldest first. */
export function BufferView(props: BufferViewProps): JSX.Element {
  const { windowId, label } = props;
  const { lines } = bufferFor(useAppState(), windowId);
  return (
    <Scrollback label={label}>
      {lines.map((line) => (
        <LineView key={line.key} line={line} windowId={windowId} />
      ))}
    </Scrollback>
  );
}
