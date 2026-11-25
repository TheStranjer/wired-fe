/**
 * Edits of the ordered sync list (decision 17): pure functions from one list
 * of account keys to the next, so `/sync` never splices arrays itself. The
 * first key is the primary; the rest are fallbacks in order.
 */

/** {@link list} without {@link key}. */
export function withoutKey(list: readonly string[], key: string): readonly string[] {
  return list.filter((listed) => listed !== key);
}

/** {@link key} first, the others after it in their order. */
export function withPrimary(list: readonly string[], key: string): readonly string[] {
  return [key, ...withoutKey(list, key)];
}

/** {@link key} one place earlier; unchanged when it is first or not listed. */
export function movedUp(list: readonly string[], key: string): readonly string[] {
  const index = list.indexOf(key);
  if (index < 1) {
    return list;
  }
  return [
    ...list.slice(0, index - 1),
    key,
    ...list.slice(index - 1, index),
    ...list.slice(index + 1),
  ];
}
