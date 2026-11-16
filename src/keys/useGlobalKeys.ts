/**
 * The one global keydown listener, as a hook.
 *
 * Every hotkey enters the app through a single `keydown` listener on `window`,
 * added in the capture phase while the caller is mounted. Each event becomes a
 * canonical chord (see `./chord`) and is handed to `handler`; what a chord
 * does is the caller's decision, not this module's. The handler lives in a
 * ref, so re-renders swap behaviour without re-registering the listener. The
 * one exception: a key pressed inside an open modal dialog belongs to that
 * dialog (WFE-125) and never reaches any handler.
 */
import { useEffect, useRef } from 'react';

import { chordFromEvent } from './chord';

/** Return true when the chord was handled: the event's default is then prevented. */
export type ChordHandler = (chord: string, event: KeyboardEvent) => boolean;

/**
 * True when {@link event} was pressed on a field of an open modal dialog: the
 * dialog owns its keys, so the shell's global listener stays out of its way.
 */
function insideDialog(event: KeyboardEvent): boolean {
  const { target } = event;
  return target instanceof Element && target.closest('[role="dialog"]') !== null;
}

/**
 * Listens for global keydowns while mounted and passes each chord to the
 * latest `handler`. Handled chords have their default prevented and their
 * propagation stopped; IME composing events, events without a chord
 * (bare modifiers, unnameable keys) and events pressed inside an open modal
 * dialog — which owns its keys (WFE-125) — never reach the handler.
 */
export function useGlobalKeys(handler: ChordHandler): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.isComposing || insideDialog(event)) {
        return;
      }
      const chord = chordFromEvent(event);
      if (chord === null) {
        return;
      }
      if (handlerRef.current(chord, event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const options = { capture: true };
    window.addEventListener('keydown', onKeyDown, options);
    return () => {
      window.removeEventListener('keydown', onKeyDown, options);
    };
  }, []);
}
