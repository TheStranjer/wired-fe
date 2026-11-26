/**
 * The page never scrolls (WFE-260): the shell fills the viewport and only the
 * panes scroll. Visually-hidden spans inside a long scrollback, such as the
 * `***` prefix of every error line, must not become scrollable overflow of the
 * document, so the command line stays on screen.
 */

import { expect, test, type Page } from '@playwright/test';

import { logRegion, signIn, submit } from './fixtures/session';
import { boxOf, expectInsideViewport } from './fixtures/tiling';

/** How many error lines pile up in the scrollback. */
const ERROR_LINES = 30;

/** The document's scroll height, its scroll offset and the viewport height. */
async function pageMetrics(
  page: Page,
): Promise<{ scrollHeight: number; scrollY: number; innerHeight: number }> {
  return page.evaluate(() => ({
    scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
    scrollY: window.scrollY,
    innerHeight: window.innerHeight,
  }));
}

/** Fills the status scrollback with error lines and scrolls it back to its top. */
async function fillAndScrollUp(page: Page): Promise<void> {
  for (let line = 0; line < ERROR_LINES; line += 1) {
    await submit(page, '/nosuchcommand');
  }
  const log = logRegion(page, 'status');
  await expect(log.getByText('Unknown command: /nosuchcommand').last()).toBeVisible();
  await log.evaluate((element) => {
    element.scrollTo(0, 0);
  });
}

/** Tries every way a reader scrolls the page: the wheel over the header and the status line, and `End`. */
async function tryToScrollPage(page: Page, statusY: number): Promise<void> {
  await page.mouse.move(2, 2);
  await page.mouse.wheel(0, 2000);
  await page.mouse.move(2, statusY);
  await page.mouse.wheel(0, 2000);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await page.keyboard.press('End');
}

test('a long scrollback of error lines never makes the page scroll', async ({ page }) => {
  await signIn(page);
  await submit(page, '/win 1');
  await fillAndScrollUp(page);

  const before = await pageMetrics(page);
  expect(before.scrollHeight).toBeLessThanOrEqual(before.innerHeight);

  const line = page.getByRole('combobox', { name: 'Command line' });
  await tryToScrollPage(page, (await boxOf(line)).y - 2);

  const after = await pageMetrics(page);
  expect(after.scrollY).toBe(0);
  expect(after.scrollHeight).toBeLessThanOrEqual(after.innerHeight);
  expectInsideViewport(page, await boxOf(line));
});
