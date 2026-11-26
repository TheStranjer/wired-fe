/**
 * How the open start menu closes on its own (WFE-299): a mousedown outside it
 * and outside any dialog it opened, or an Escape pressed inside it, which
 * hands focus back to the menu's button. A dialog is a portal outside the
 * menu's element, so the ask rows' dialogs are told apart by their role.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';

/** What the dismissal acts on. */
type StartDismiss = {
  /** Whether the menu is open; nothing is listened to while it is not. */
  readonly open: boolean;
  /** The element holding the button and the menu. */
  readonly rootRef: RefObject<HTMLElement | null>;
  /** The button, which takes focus back on Escape. */
  readonly buttonRef: RefObject<HTMLElement | null>;
  /** Closes the menu. */
  readonly close: () => void;
};

/** Whether {@link target} is in {@link root} or in a dialog. */
function isInside(root: HTMLElement | null, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return root?.contains(target) === true || target.closest('[role="dialog"]') !== null;
}

/** Close the open menu on a mousedown outside it and on Escape inside it. */
export function useStartDismiss(dismiss: StartDismiss): void {
  const { open, rootRef, buttonRef, close } = dismiss;
  useEffect(() => {
    if (!open) {
      return;
    }
    const onMouseDown = (event: MouseEvent): void => {
      if (!isInside(rootRef.current, event.target)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      const { target } = event;
      if (
        event.key === 'Escape' &&
        target instanceof Node &&
        rootRef.current?.contains(target) === true
      ) {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return (): void => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, rootRef, buttonRef, close]);
}
