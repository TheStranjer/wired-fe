/**
 * A desktop's only tiled pane fills the desktop (WFE-259): however it came to
 * be the root of the split tree, and however short its widest line is, the
 * pane's box is the desktop area's box. Layout needs a real browser, so jsdom
 * cannot check it.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { logRegion, showWindow, signIn, submit } from './fixtures/session';
import { boxOf, desktopButton, pane } from './fixtures/tiling';

/** The most a pane's edge may differ from the desktop's, in pixels. */
const TOLERANCE = 2;

/** Puts a long unwrapped line in the status window, then opens an empty desktop 2. */
async function emptyDesktopWithLongLine(page: Page): Promise<void> {
  await signIn(page);
  await showWindow(page, 'status');
  await submit(page, '/vsplit omni');
  await expect(logRegion(page, 'status')).toContainText('Unknown view: omni');
  await submit(page, '/desktop 2');
  await expect(desktopButton(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText(/^empty desktop/u)).toBeVisible();
}

/** Asserts that {@link frame} covers the whole desktop area. */
async function expectFillsDesktop(page: Page, frame: Locator): Promise<void> {
  const desktop = await boxOf(page.getByRole('main'));
  await expect
    .poll(async () => {
      const box = await boxOf(frame);
      return [
        Math.abs(box.x - desktop.x),
        Math.abs(box.y - desktop.y),
        Math.abs(box.width - desktop.width),
        Math.abs(box.height - desktop.height),
      ].every((difference) => difference <= TOLERANCE);
    })
    .toBe(true);
}

test('the first pane of an empty desktop fills it', async ({ page }) => {
  await emptyDesktopWithLongLine(page);
  await submit(page, '/vsplit win 1');
  await expect(pane(page, 'status')).toHaveCount(1);
  await expectFillsDesktop(page, pane(page, 'status'));
});

test('the pane left after closing one half of a split fills the desktop', async ({ page }) => {
  await emptyDesktopWithLongLine(page);
  await submit(page, '/vsplit win 1');
  await submit(page, '/vsplit win 1');
  await expect(pane(page, 'status')).toHaveCount(2);
  await submit(page, '/unsplit');
  await expect(pane(page, 'status')).toHaveCount(1);
  await expectFillsDesktop(page, pane(page, 'status'));
});
