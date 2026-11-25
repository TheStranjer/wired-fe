/**
 * The rule for making a desktop (ARCHITECTURE.md decisions 12 and 18): a
 * desktop may be appended only when the last existing one is not empty, and a
 * number jump makes at most one. The layout reducer and the `/desktop` command
 * both read it here, so the one that refuses and the one that explains cannot
 * disagree. Pure.
 */
import { isEmptyDesktop } from './desktopPanes';
import type { Desktop } from './desktopPanes';

/** The part of the desktops state the rule reads. */
type Desks = { readonly desktops: readonly Desktop[]; readonly active: number };

/** Whether a desktop may be appended: the last existing desktop holds something. */
export function canAppendDesktop(state: Desks): boolean {
  const last = state.desktops.at(-1);
  return last === undefined || !isEmptyDesktop(last);
}

/**
 * Why showing desktop `n` (1-based) is refused, or null when it is allowed:
 * `n` exists, or `n` is the one desktop that may be appended.
 */
export function appendRefusal(state: Desks, n: number): string | null {
  const count = state.desktops.length;
  if (n <= count) {
    return null;
  }
  if (n > count + 1) {
    return `No desktop ${String(n)}; desktops run 1–${String(count)}`;
  }
  if (canAppendDesktop(state)) {
    return null;
  }
  const how = state.active === count - 1 ? 'put something on it' : 'use it';
  return `Desktop ${String(count)} is empty: ${how} before making another`;
}
