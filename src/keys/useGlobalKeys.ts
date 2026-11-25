/**
 * The one global keydown listener, as a hook.
 *
 * Every hotkey enters the app through a single `keydown` listener on `window`,
 * added in the capture phase while the caller is mounted. Each event becomes a
 * canonical chord (see `./chord`) and is handed to `handler`; what a chord
 * does is the caller's decision, not this module's. The handler lives in a
 * ref, so re-renders swap behaviour without re-registering the listener. The
 * one exception: a key pressed inside an open modal dialog (WFE-125) or
 * dropdown menu (WFE-190) belongs to it and never reaches any handler.
 * {@link usePendingKeys} holds the prefix of a multi-chord binding between two
 * presses (decision 18).
 */
import { useEffect, useRef, useState } from 'react';

import { chordFromEvent } from './chord';
import type { InputMode } from './mode';

/** Return true when the chord was handled: the event's default is then prevented. */
export type ChordHandler = (chord: string, event: KeyboardEvent) => boolean;

/**
 * True when {@link event} was pressed on a field of an open modal dialog or
 * in an open dropdown menu (WFE-190): each owns its keys, so the shell's
 * global listener stays out of its way.
 */
function insideDialog(event: KeyboardEvent): boolean {
  const { target } = event;
  return target instanceof Element && target.closest('[role="dialog"], [role="menu"]') !== null;
}

/**
 * Listens for global keydowns while mounted and passes each chord to the
 * latest `handler`. Handled chords have their default prevented and their
 * propagation stopped; IME composing events, events without a chord
 * (bare modifiers, unnameable keys) and events pressed inside an open modal
 * dialog or dropdown menu — which own their keys (WFE-125, WFE-190) — never
 * reach the handler.
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

/** The prefix of a key sequence waiting for its next chord (decision 18), and how to change it. */
export type PendingKeys = {
  /** The canonical chords pressed so far, e.g. `Ctrl+B`; null when no sequence is under way. */
  readonly prefix: string | null;
  /** Wait for more chords after {@link prefix}, or give up waiting with null. */
  readonly setPrefix: (prefix: string | null) => void;
};

/** A prefix and the mode it was pressed in: it is void once the mode moves on. */
type HeldPrefix = { readonly prefix: string | null; readonly mode: InputMode };

/**
 * The pending key prefix of a keyboard in {@link mode}. It resets when the mode
 * changes — a prefix never carries across modes — and when the window loses
 * focus, so a half-typed sequence cannot wait forever behind another tab. No
 * timers: only a chord, a mode change or a blur ends the wait.
 */
export function usePendingKeys(mode: InputMode): PendingKeys {
  const [held, setHeld] = useState<HeldPrefix>({ prefix: null, mode });

  useEffect(() => {
    const onBlur = (): void => {
      setHeld({ prefix: null, mode });
    };
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('blur', onBlur);
    };
  }, [mode]);

  return {
    prefix: held.mode === mode ? held.prefix : null,
    setPrefix: (prefix) => {
      setHeld({ prefix, mode });
    },
  };
}
