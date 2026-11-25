/**
 * What a click says beyond "clicked": which button and which modifier keys
 * were down. A mouse event satisfies it as it is, so the ui layer can hand
 * its events to the app without importing any app type.
 */

/** The parts of a mouse event a click's placement is read from. */
export type ClickModifiers = {
  /** 0 is the primary button, 1 the middle one. */
  readonly button: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
};

/** Whether {@link click} is the middle button, which the browser reports as an auxiliary click. */
export function isMiddleClick(click: Pick<ClickModifiers, 'button'>): boolean {
  return click.button === 1;
}
