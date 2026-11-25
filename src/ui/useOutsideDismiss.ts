/**
 * Closing an open {@link MenuButton} menu on a mousedown outside it.
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * While `open`, a mousedown outside the element the returned ref is put on
 * calls `dismiss`. A mousedown inside it (the button, the menu) does not.
 */
export function useOutsideDismiss(
  open: boolean,
  dismiss: () => void,
): RefObject<HTMLDivElement | null> {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onMouseDown = (event: MouseEvent): void => {
      if (!(event.target instanceof Node && rootRef.current?.contains(event.target) === true)) {
        dismiss();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return (): void => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, dismiss]);

  return rootRef;
}
