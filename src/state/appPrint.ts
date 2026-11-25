/**
 * The print transition of the core reducer (AGENTS.md "Layout"): one client
 * message at the bottom of the window that takes it. Like ./appReducer it
 * names only the slice of the app state it needs, and hands that slice back
 * with the line added.
 */

import { printTarget, putBuffer } from './appReducer';
import { type Buffer, EMPTY_BUFFER, appendSystem, type LineLevel } from './buffer';
import type { WindowsState } from '../windows/model';

/** One client line to print. */
export type PrintLine = {
  /** The window to print in, or null for the active one; unknown means window 1. */
  readonly windowId: string | null;
  readonly date: Date;
  readonly level: LineLevel;
  readonly text: string;
  /** Decorative ASCII art (WFE-135): the view hides it from assistive technology. */
  readonly decorative?: boolean;
};

/** What printing reads and writes: the windows, their scrollbacks and the counter. */
export type PrintSlice = {
  readonly windows: WindowsState;
  readonly buffers: ReadonlyMap<string, Buffer>;
  readonly seq: number;
};

/** The state with {@link line} at the bottom of the window that takes it, keyed by `seq`. */
export function withPrinted<S extends PrintSlice>(state: S, line: PrintLine): S {
  const id = printTarget(state.windows, line.windowId);
  const { date, level, text, decorative } = line;
  const buffer = appendSystem(
    state.buffers.get(id) ?? EMPTY_BUFFER,
    { date, level, text, ...(decorative === true ? { decorative } : {}) },
    state.seq,
  );
  return { ...state, buffers: putBuffer(state.buffers, id, buffer), seq: state.seq + 1 };
}
