/**
 * Which side of its text box a suggestion list is drawn on (WFE-302): above
 * it, as on the command line, unless the box is so near the top of the screen
 * that the list would not fit there, and then below it. The list is measured,
 * not designed, so the side is written onto its element as `data-side`, which
 * its stylesheet reads, the way ./useAutoGrow writes a height.
 */

import { type RefObject, useLayoutEffect } from 'react';

/**
 * Put `data-side` on the suggestion list inside {@link field} whenever
 * {@link rows} changes: `below` when the room above the field is shorter than
 * the list, else `above`. The list is the element that holds the listbox.
 */
export function usePopupSide(field: RefObject<HTMLElement | null>, rows: number): void {
  useLayoutEffect(() => {
    const box = field.current;
    const list = box?.querySelector('[role="listbox"]')?.parentElement;
    if (box !== null && list !== null && list !== undefined) {
      const room = box.getBoundingClientRect().top;
      list.setAttribute('data-side', room < list.offsetHeight ? 'below' : 'above');
    }
  }, [field, rows]);
}
