/**
 * The floating windows of one desktop (ARCHITECTURE.md decision 12): panes
 * torn off the split tree into free rectangles above it. Rectangles are
 * fractions of the viewport and always clamped inside it; array order is
 * z-order, last on top. Pure: every function returns the input unchanged (same
 * reference) when the pane id is unknown.
 */

/** A rectangle as fractions of the viewport: 0..1 on both axes. */
export type FloatRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

/** A float: pane `paneId` showing window `windowId` in `rect`. */
export type FloatPane = {
  readonly paneId: string;
  readonly windowId: string;
  readonly rect: FloatRect;
};

/** A desktop's floats, bottom to top. */
export type Floats = readonly FloatPane[];

/** The smallest width or height of a float, as a fraction of the viewport. */
export const MIN_FLOAT_SIZE = 0.1;

/** Where a first float opens: centred, half the viewport wide and 0.6 high. */
export const DEFAULT_FLOAT_RECT: FloatRect = { x: 0.25, y: 0.2, w: 0.5, h: 0.6 };

/** How far each further float is offset from the previous one when cascading. */
const CASCADE_STEP = 0.03;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The rectangle with its size within [MIN_FLOAT_SIZE, 1] and fully inside 0..1. */
export function clampRect(rect: FloatRect): FloatRect {
  const w = clamp(rect.w, MIN_FLOAT_SIZE, 1);
  const h = clamp(rect.h, MIN_FLOAT_SIZE, 1);
  return { x: clamp(rect.x, 0, 1 - w), y: clamp(rect.y, 0, 1 - h), w, h };
}

/** The float with this pane id, or null. */
export function findFloat(floats: Floats, paneId: string): FloatPane | null {
  return floats.find((float) => float.paneId === paneId) ?? null;
}

/**
 * Adds a float on top. Without `rect` it cascades from DEFAULT_FLOAT_RECT by
 * 0.03 per existing float; either way the rectangle is clamped.
 */
export function addFloat(
  floats: Floats,
  paneId: string,
  ...shown: readonly [windowId: string, rect?: FloatRect]
): Floats {
  const [windowId, rect] = shown;
  const offset = CASCADE_STEP * floats.length;
  const start = rect ?? {
    ...DEFAULT_FLOAT_RECT,
    x: DEFAULT_FLOAT_RECT.x + offset,
    y: DEFAULT_FLOAT_RECT.y + offset,
  };
  return [...floats, { paneId, windowId, rect: clampRect(start) }];
}

/** Replaces the float `paneId` with `change(float)`; unchanged when it is unknown. */
function mapFloat(floats: Floats, paneId: string, change: (float: FloatPane) => FloatPane): Floats {
  if (findFloat(floats, paneId) === null) {
    return floats;
  }
  return floats.map((float) => (float.paneId === paneId ? change(float) : float));
}

/** Moves the float by (dx, dy) viewport fractions, keeping it inside the viewport. */
export function moveFloat(
  floats: Floats,
  paneId: string,
  ...delta: readonly [dx: number, dy: number]
): Floats {
  const [dx, dy] = delta;
  return mapFloat(floats, paneId, (float) => ({
    ...float,
    rect: clampRect({ ...float.rect, x: float.rect.x + dx, y: float.rect.y + dy }),
  }));
}

/** Resizes the float from its bottom-right corner by (dw, dh), clamped. */
export function resizeFloat(
  floats: Floats,
  paneId: string,
  ...delta: readonly [dw: number, dh: number]
): Floats {
  const [dw, dh] = delta;
  return mapFloat(floats, paneId, (float) => ({
    ...float,
    rect: clampRect({ ...float.rect, w: float.rect.w + dw, h: float.rect.h + dh }),
  }));
}

/** Moves the float to the top of the z-order. */
export function raiseFloat(floats: Floats, paneId: string): Floats {
  const float = findFloat(floats, paneId);
  if (float === null) {
    return floats;
  }
  return [...floats.filter((other) => other !== float), float];
}

/** Removes the float. */
export function removeFloat(floats: Floats, paneId: string): Floats {
  if (findFloat(floats, paneId) === null) {
    return floats;
  }
  return floats.filter((float) => float.paneId !== paneId);
}

/** Shows another window in the float `paneId`. */
export function setFloatWindow(floats: Floats, paneId: string, windowId: string): Floats {
  return mapFloat(floats, paneId, (float) => ({ ...float, windowId }));
}
