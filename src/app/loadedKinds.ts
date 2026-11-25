/**
 * The window kinds, loaded once when the app loads, for every region that
 * draws a window: the desktop's panes (./DesktopView) and the topic bar
 * (./Root) share this one load.
 */
import { loadWindowKinds } from './windowKinds';
import type { WindowKindDefinition } from '../state/windowKind';
import type { WindowKind } from '../windows/model';

/** The one load every mount shares: the window kinds, or why they failed. */
export const KINDS = loadWindowKinds();

/** The kind map the shell draws from; empty when the load failed. */
export const WINDOW_KINDS: ReadonlyMap<WindowKind, WindowKindDefinition> = KINDS.ok
  ? KINDS.value
  : new Map();
