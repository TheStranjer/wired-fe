/**
 * The composer overlay of the shell (WFE-125): the open box lives here, and
 * Root renders what the hook hands back. `/compose` and its chords ask for it
 * through the command context, and the box sends through the very post handler
 * plain text uses — a long post means whatever the active window says a post
 * means, pending media and all (WFE-126). The active account's instance sets
 * the length limit and decides whether the local audience is offered
 * (decision 5, src/state/composerActions).
 */

import { useState } from 'react';
import type { JSX } from 'react';

import { useCommandContext } from './useCommandContext';
import type { CommandContext } from '../commands/types';
import { composerLimits } from '../state/composerActions';
import { useAppState } from '../state/StateContext';
import { Overlay } from '../ui/Overlay';
import { Composer } from '../views/Composer';

/** Whether the composer box is open, and the text it opened with. */
type ComposerState = {
  readonly open: boolean;
  readonly initialText: string;
};

/** The box, closed and empty: where the shell starts and returns to. */
const NOT_OPEN: ComposerState = { open: false, initialText: '' };

/** The command-line setter this context never needs: only its post handler is read. */
function ignoreInput(): void {
  // The overlay posts; it never rewrites the command line.
}

/** What the composer overlay gives Root: the opener commands call, and the box. */
export type ComposerOverlay = {
  /** Open the box filled with {@link initialText}; it goes into the command context. */
  readonly openComposer: (initialText: string) => void;
  /** The open box over the shell, or null while the shell needs none. */
  readonly overlay: JSX.Element | null;
};

/** The composer overlay of this render: its open state, its opener, its element. */
export function useComposerOverlay(attachments: CommandContext['attachments']): ComposerOverlay {
  const state = useAppState();
  const [composer, setComposer] = useState<ComposerState>(NOT_OPEN);
  const openComposer = (initialText: string): void => {
    setComposer({ open: true, initialText });
  };
  const closeComposer = (): void => {
    setComposer(NOT_OPEN);
  };
  const { post } = useCommandContext(ignoreInput, openComposer, attachments);
  const { allowLocal, maxCharacters } = composerLimits(state, state.activeAccountKey);
  if (!composer.open) {
    return { openComposer, overlay: null };
  }
  return {
    openComposer,
    overlay: (
      <Overlay label="Compose" onClose={closeComposer}>
        <Composer
          allowLocal={allowLocal}
          defaultVisibility={state.settings.defaultVisibility}
          initialText={composer.initialText}
          maxCharacters={maxCharacters}
          onClose={closeComposer}
          onSubmit={post}
        />
      </Overlay>
    ),
  };
}
