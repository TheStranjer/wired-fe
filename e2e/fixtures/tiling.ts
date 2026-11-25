/**
 * What the tiling-desktop specs (WFE-250) share: the locators that find a pane,
 * a desktop button and a float by role and accessible name, the key presses of
 * a hotkey sequence, and the pointer drags that move a float or a divider.
 * Assertions stay in the specs.
 */

import { expect, type Locator, type Page } from '@playwright/test';

/** A rectangle in page pixels, as Playwright measures an element. */
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** A point in page pixels. */
type Point = { readonly x: number; readonly y: number };

/** {@link text} as a regular expression source, whatever punctuation a title carries. */
function escaped(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Every pane or float showing the window titled {@link title}, in document order: the tree first, then the floats. */
export function pane(page: Page, title: string): Locator {
  return page.getByRole('region', { name: new RegExp(`^${escaped(title)}(?: |$)`, 'u') });
}

/** The float showing the window {@link title}: the only kind of pane with a Dock button. */
export function floatOf(page: Page, title: string): Locator {
  return pane(page, title).filter({ has: page.getByRole('button', { name: /^Dock / }) });
}

/** The status line's button for desktop {@link number}. */
export function desktopButton(page: Page, number: number): Locator {
  return page.getByRole('button', { name: new RegExp(`^Desktop ${String(number)}(?:,|$)`, 'u') });
}

/** The title bar of {@link frame}, which holds the `[*]` of the focused pane. */
export function titleBar(frame: Locator): Locator {
  return frame.locator('header');
}

/** Presses {@link keys} one after another, as a key sequence is typed. */
export async function press(page: Page, ...keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

/** Answers every hashtag timeline with no posts, so `/vsplit tag rust` has an instance to ask. */
export async function routeTags(page: Page): Promise<void> {
  await page.route('**/api/v1/timelines/tag/**', async (route) => {
    await route.fulfill({ json: [] });
  });
}

/** The box of {@link locator}, which must be on the page. */
export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('the element has no box on the page');
  }
  return box;
}

/** The middle of {@link box}. */
export function centerOf(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A point on the left of a title bar, where its title is and no button is. */
export function grabOf(box: Box): Point {
  return { x: box.x + 12, y: box.y + box.height / 2 };
}

/** Presses the mouse at {@link start}, moves it by {@link by} in steps, and lets go. */
export async function dragFrom(page: Page, start: Point, by: Point): Promise<void> {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + by.x, start.y + by.y, { steps: 8 });
  await page.mouse.up();
}

/** How far a glyph may stick out of its button, in pixels, to allow for rounding. */
const GLYPH_TOLERANCE = 0.5;

/**
 * How far the text of {@link button} sticks out past its own box, in pixels
 * (zero or less means inside), one number per text node: the largest overshoot
 * of the four edges, measured with a `Range` over the text node.
 */
async function glyphOverflows(button: Locator): Promise<number[]> {
  return button.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const box = element.getBoundingClientRect();
    const overflows: number[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const glyph = range.getBoundingClientRect();
      overflows.push(
        Math.max(
          box.top - glyph.top,
          glyph.bottom - box.bottom,
          box.left - glyph.left,
          glyph.right - box.right,
        ),
      );
    }
    return overflows;
  });
}

/** Asserts that the text of {@link button} lies inside its box, within rounding. */
export async function expectGlyphInside(button: Locator): Promise<void> {
  const overflows = await glyphOverflows(button);
  expect(overflows.length).toBeGreaterThan(0);
  for (const overflow of overflows) {
    expect(overflow).toBeLessThanOrEqual(GLYPH_TOLERANCE);
  }
}

/** Asserts that {@link box} lies wholly inside the page's viewport. */
export function expectInsideViewport(page: Page, box: Box): void {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual((viewport?.height ?? 0) + 0.5);
}
