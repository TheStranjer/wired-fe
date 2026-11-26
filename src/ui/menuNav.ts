/**
 * Which item of a dropdown menu takes focus next. Pure index arithmetic for
 * {@link MenuButton}: arrow keys wrap, Home/End jump, a typed letter jumps to
 * the next label starting with it, and disabled items are never landed on.
 * Every function answers an index into `items`, or -1 when no item qualifies.
 */

/** One row of a dropdown menu. */
export type MenuItem = {
  /** What `onSelect` is called with. */
  readonly id: string;
  /** The visible text. */
  readonly label: string;
  /** When defined the row is a checkbox item, ticked or not. */
  readonly checked?: boolean;
  /** A disabled row is shown but can be neither focused nor selected. */
  readonly disabled?: boolean;
  /** Draws a rule above the row, to set it apart from the rows before it. */
  readonly separated?: boolean;
  /** Accessible name when the visible text alone would not say it all. */
  readonly name?: string;
};

/** The parts of a key event the menu's navigation looks at. */
export type NavKey = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>;

/** The first enabled item, or -1. */
export function firstEnabled(items: readonly MenuItem[]): number {
  return items.findIndex((item) => item.disabled !== true);
}

/** The last enabled item, or -1. */
export function lastEnabled(items: readonly MenuItem[]): number {
  return items.findLastIndex((item) => item.disabled !== true);
}

/**
 * The items in the order a walk of `delta` (1 or -1) steps from `from` meets
 * them, wrapping round the ends and meeting `from` itself last, each with its
 * index.
 */
function walk(
  items: readonly MenuItem[],
  from: number,
  delta: number,
): (readonly [number, MenuItem])[] {
  const entries = [...items.entries()];
  return delta > 0
    ? [...entries.slice(from + 1), ...entries.slice(0, from + 1)]
    : [...entries.slice(0, from).reverse(), ...entries.slice(from).reverse()];
}

/** The index of the first enabled entry for which `test` holds, or -1. */
function pick(
  entries: readonly (readonly [number, MenuItem])[],
  test: (item: MenuItem) => boolean,
): number {
  const hit = entries.find(([, item]) => item.disabled !== true && test(item));
  return hit?.[0] ?? -1;
}

/** Any enabled item. */
function anyItem(): boolean {
  return true;
}

/** True for a plain printable character: no modifier chord, not Space. */
function isTypedLetter(key: NavKey): boolean {
  return key.key.length === 1 && key.key !== ' ' && !(key.ctrlKey || key.metaKey || key.altKey);
}

/**
 * Where the key moves focus from item `active`: the new index, -1 when the
 * key navigates but nothing qualifies (focus stays), or null when the key is
 * not a navigation key at all.
 */
export function navTarget(items: readonly MenuItem[], active: number, key: NavKey): number | null {
  switch (key.key) {
    case 'ArrowDown':
      return pick(walk(items, active, 1), anyItem);
    case 'ArrowUp':
      return pick(walk(items, active, -1), anyItem);
    case 'Home':
      return firstEnabled(items);
    case 'End':
      return lastEnabled(items);
    default:
      break;
  }
  if (!isTypedLetter(key)) {
    return null;
  }
  const wanted = key.key.toLowerCase();
  return pick(walk(items, active, 1), (item) => item.label.toLowerCase().startsWith(wanted));
}
