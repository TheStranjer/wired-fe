/**
 * The settings a reader chooses for themselves (AGENTS.md "Layout": src/state
 * holds the pure app state, settings among it): how the scrollback prints a
 * moment, who a new post is aimed at by default, and whether the CRT effects
 * and media behind a content warning start open. Plain data with one default
 * record; getting them in and out of storage is the storage module's business,
 * and the `/settings` command is the command registry's.
 */

import type { Visibility } from '../api/schemas/status';
import type { ClockFormat } from '../lib/time';

/** What the reader can change, one value per knob. */
export type Settings = {
  /** How every timestamp in the scrollback is rendered (src/lib/time). */
  readonly clockFormat: ClockFormat;
  /** The audience a post gets when the command naming it says nothing else. */
  readonly defaultVisibility: Visibility;
  /** Whether the CRT/glitch effects are on at all; they never flash. */
  readonly effects: boolean;
  /** Whether media behind a content warning is shown without asking. */
  readonly expandMedia: boolean;
};

/** A session that has changed nothing: a 24-hour clock, public posts, no effects. */
export const DEFAULT_SETTINGS: Settings = {
  clockFormat: '24h',
  defaultVisibility: 'public',
  effects: false,
  expandMedia: false,
};
