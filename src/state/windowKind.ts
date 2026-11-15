/**
 * The contract a window kind fulfils (AGENTS.md "Windows, like IRC buffers").
 * Each kind is implemented by one feature folder `src/features/<name>/` that
 * self-registers by exporting a `windowKind` from `windowKind.tsx`;
 * src/app/windowKinds.ts collects the definitions, the same way command
 * definitions self-register (decision 6). The types live in the pure state
 * layer so features, commands and the shell can share them without importing
 * each other — lower layers never import higher ones.
 */

import type { ComponentType } from 'react';

import type { AppState } from './appState';
import type { Draft } from './draft';
import type { AppAction } from './reducer';
import type { WindowKind, WindowState } from '../windows/model';

/**
 * What a kind's post handler may do while posting: read the app state, ask
 * for transitions, and stamp things with the current moment. The app builds
 * one per post, the way the command layer builds its command context.
 */
export type PostContext = {
  /** The whole app state as it is while the post runs. */
  readonly state: AppState;
  /** Ask the application's one reducer for a transition. */
  readonly dispatch: (a: AppAction) => void;
  /** The current moment, so posts and printed lines can be stamped. */
  readonly now: () => Date;
};

/**
 * One window kind as the app sees it: what its topic line says, which
 * component renders the window, and what posting into it means.
 */
export type WindowKindDefinition = {
  /** Which kind of view this definition implements. */
  readonly kind: WindowKind;
  /** Topic line text for the TopicBar. */
  readonly topic: (window: WindowState, state: AppState) => string;
  /** The component rendering one window of this kind, by window id. */
  readonly Component: ComponentType<{ readonly windowId: string }>;
  /**
   * What posting in this window does. Absent = posting is not possible here.
   * Resolves to an error message or null.
   */
  readonly onPost?: (
    draft: Draft,
    window: WindowState,
    context: PostContext,
  ) => Promise<string | null>;
};
