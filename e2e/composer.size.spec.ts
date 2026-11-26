/**
 * The composer's text box sizes itself to its window (WFE-296): in a tall
 * float it takes most of the pane, in a short one it shrinks (never below three
 * lines) and the send row stays in view, and the window's client message shows
 * under the form. Layout needs a real browser, so jsdom cannot check it.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { logRegion, signIn, submit } from './fixtures/session';
import { boxOf, floatOf } from './fixtures/tiling';

/** A viewport tall enough that the shorter float still holds the whole form. */
const VIEWPORT = { width: 1280, height: 1000 };

/** The float's growth to a tall window, then its shrinking to a short one, in percent of the viewport. */
const TALL = '+20';
const SHORT = '-35';

/** Opens the composer in a float and answers the float and its text box. */
async function openFloatedComposer(page: Page): Promise<{ float: Locator; text: Locator }> {
  await submit(page, '/composer');
  await submit(page, '/float');
  const float = floatOf(page, 'compose');
  await expect(float).toBeVisible();
  return { float, text: float.getByRole('textbox', { name: 'Post text' }) };
}

/** The pixel height of three lines of {@link text}. */
async function threeLines(text: Locator): Promise<number> {
  return text.evaluate((element) => {
    return parseFloat(getComputedStyle(element).lineHeight) * 3;
  });
}

/** Resizes the focused float by {@link dh} percent of the viewport height. */
async function resizeFloat(page: Page, dh: string): Promise<void> {
  await submit(page, `/float size 0 ${dh}`);
}

/** Asserts the send button lies inside {@link float} without the pane scrolling. */
async function expectSendVisible(float: Locator): Promise<void> {
  const frame = await boxOf(float);
  const send = await boxOf(float.getByRole('button', { name: '[ send ]' }));
  expect(send.y).toBeGreaterThanOrEqual(frame.y);
  expect(send.y + send.height).toBeLessThanOrEqual(frame.y + frame.height);
  const scrolls = await float.evaluate((element) =>
    [...element.querySelectorAll('*')].some(
      (child) =>
        child.scrollHeight > child.clientHeight + 1 &&
        getComputedStyle(child).overflowY === 'auto' &&
        child.getAttribute('role') !== 'log',
    ),
  );
  expect(scrolls).toBe(false);
}

test('the text box grows with a tall float and shrinks with a short one', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await signIn(page);
  const { float, text } = await openFloatedComposer(page);

  await resizeFloat(page, TALL);
  await expect
    .poll(async () => (await boxOf(text)).height / (await boxOf(float)).height)
    .toBeGreaterThan(0.5);
  const tall = (await boxOf(text)).height;

  await resizeFloat(page, SHORT);
  await expect.poll(async () => (await boxOf(text)).height).toBeLessThan(tall);
  expect((await boxOf(text)).height).toBeGreaterThanOrEqual((await threeLines(text)) - 1);
  await expectSendVisible(float);
});

test('a client message shows under the form', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await signIn(page);
  const { float, text } = await openFloatedComposer(page);

  await text.fill('present day, present time');
  await text.press('Control+Enter');

  const message = logRegion(page, 'compose').getByText(/^Posted as @/u);
  await expect(message).toBeVisible();
  const frame = await boxOf(float);
  const line = await boxOf(message);
  expect(line.y + line.height).toBeLessThanOrEqual(frame.y + frame.height);
  await expectSendVisible(float);
});
