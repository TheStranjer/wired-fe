/**
 * Post labels: the short `[a3]` tags commands and the scrollback refer to
 * posts by (AGENTS.md "Every post has a short label"). One LabelBook per
 * window; posts are labelled in arrival order and keep their label for the
 * life of the book. Pure state: every assignment returns a new book.
 */

/** Letters a label may use: `a` to `z`. */
const ALPHABET = 26;

/** Labels sharing one leading letter: the digits `0` to `9`. */
const DIGITS = 10;

/** Character code of `a`, the first label letter. */
const CODE_A = 'a'.charCodeAt(0);

/**
 * Which letter block an index falls in: how many leading letters its label
 * has and how far into that block it sits. One letter covers the first 260
 * indexes, two letters the next 6760, and each further letter multiplies.
 */
function blockForIndex(index: number): readonly [letterCount: number, offset: number] {
  let letterCount = 1;
  let start = 0;
  let size = ALPHABET * DIGITS;
  while (index >= start + size) {
    start += size;
    letterCount += 1;
    size = ALPHABET ** letterCount * DIGITS;
  }
  return [letterCount, index - start];
}

/** `value` as base-26 letters `a` to `z`, exactly `letterCount` wide, last letter varying fastest. */
function spellLetters(value: number, letterCount: number): string {
  let rest = value;
  let spelled = '';
  for (let at = 0; at < letterCount; at += 1) {
    spelled = String.fromCharCode(CODE_A + (rest % ALPHABET)) + spelled;
    rest = Math.floor(rest / ALPHABET);
  }
  return spelled;
}

/** The label for the n-th assigned post (0-based). */
export function labelForIndex(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`labelForIndex needs a non-negative integer, got ${String(index)}`);
  }
  const [letterCount, offset] = blockForIndex(index);
  const digit = String(offset % DIGITS);
  return `${spellLetters(Math.floor(offset / DIGITS), letterCount)}${digit}`;
}

/** One window's label tables plus the index the next new label takes. */
export type LabelBook = {
  readonly byId: ReadonlyMap<string, string>;
  readonly byLabel: ReadonlyMap<string, string>;
  readonly next: number;
};

/** The book of a window that has labelled nothing yet. */
export const EMPTY_LABEL_BOOK: LabelBook = {
  byId: new Map(),
  byLabel: new Map(),
  next: 0,
};

/** Returns the book with `id` labelled (unchanged, same object, if it already has one) and its label. */
export function assignLabel(book: LabelBook, id: string): readonly [LabelBook, string] {
  const existing = book.byId.get(id);
  if (existing !== undefined) {
    return [book, existing];
  }
  const label = labelForIndex(book.next);
  const grown: LabelBook = {
    byId: new Map(book.byId).set(id, label),
    byLabel: new Map(book.byLabel).set(label, id),
    next: book.next + 1,
  };
  return [grown, label];
}

/** The id a label stands for, whatever case it was typed in (`A3` finds `a3`), or `undefined`. */
export function idForLabel(book: LabelBook, label: string): string | undefined {
  return book.byLabel.get(label.toLowerCase());
}

/** The label `id` was given, or `undefined` if it has none. */
export function labelForId(book: LabelBook, id: string): string | undefined {
  return book.byId.get(id);
}
