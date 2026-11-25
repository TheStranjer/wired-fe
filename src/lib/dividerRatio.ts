/**
 * The arithmetic behind a draggable pane divider (WFE-221): where a pointer
 * sits along a split container as a ratio, and what each key does to a ratio.
 * Pure; no DOM, no layout types, so any layer may use it.
 */

/** The smallest and largest ratio a divider may take. */
export type RatioBounds = { readonly min: number; readonly max: number };

/** A container's extent along one axis, in the pointer's coordinates. */
export type Span = { readonly start: number; readonly size: number };

/** The part of a keyboard event a divider cares about. */
export type DividerKeyEvent = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
};

/** What double-click resets a divider to. */
export const DEFAULT_RATIO = 0.5;

/** How far an arrow key moves the ratio. */
const KEY_STEP = 0.05;

/** The arrow keys and the way each moves the ratio. */
const ARROW_STEPS: ReadonlyMap<string, number> = new Map([
  ['ArrowLeft', -KEY_STEP],
  ['ArrowUp', -KEY_STEP],
  ['ArrowRight', KEY_STEP],
  ['ArrowDown', KEY_STEP],
]);

/** Keeps `ratio` within `bounds`. */
export function clampRatio(ratio: number, bounds: RatioBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, ratio));
}

/**
 * The ratio a pointer at `at` stands for along `span`, kept within `bounds`.
 * A container with no extent gives the default ratio.
 */
export function ratioFromPointer(at: number, span: Span, bounds: RatioBounds): number {
  if (span.size <= 0) {
    return clampRatio(DEFAULT_RATIO, bounds);
  }
  return clampRatio((at - span.start) / span.size, bounds);
}

/**
 * True when a divider answers {@link event} itself — an unmodified arrow key,
 * `Home` or `End` — so it must not also run as a hotkey.
 */
export function ownsDividerKey(event: DividerKeyEvent): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return false;
  }
  return ARROW_STEPS.has(event.key) || event.key === 'Home' || event.key === 'End';
}

/**
 * The ratio after `key` is pressed on a divider at `ratio`: arrows step by 5%
 * (left and up shrink, right and down grow), `Home` and `End` go to the
 * bounds, any other key changes nothing. Always within `bounds`.
 */
export function keyedRatio(key: string, ratio: number, bounds: RatioBounds): number {
  if (key === 'Home') {
    return bounds.min;
  }
  if (key === 'End') {
    return bounds.max;
  }
  const stepped = ratio + (ARROW_STEPS.get(key) ?? 0);
  return clampRatio(Math.round(stepped * 1000) / 1000, bounds);
}
