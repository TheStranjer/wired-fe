/**
 * The tiling desktop by mouse (WFE-250, decisions 12 and 13): the `┃▾` split
 * button and its view menu, the `⧉▾` pop-out button, a float dragged by its
 * title bar and docked back with `⊞`, and the dividers between panes, dragged
 * and driven with the arrow keys. The keyboard and command flows are in
 * ./tiling.spec. Everything is found by role and accessible name.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { signIn, submit } from './fixtures/session';
import {
  type Box,
  boxOf,
  centerOf,
  dragFrom,
  expectInsideViewport,
  floatOf,
  grabOf,
  pane,
  routeTags,
  titleBar,
} from './fixtures/tiling';

/** How far the float is dragged right, in pixels. */
const DRAG = 100;

/** Splits the only pane side by side with the Home view, through the `┃▾` menu. */
async function splitWithHome(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Split side by side' }).click();
  await page.getByRole('menuitem', { name: 'Home', exact: true }).click();
  await expect(pane(page, 'home')).toHaveCount(2);
}

/** Tears the second pane off into a float, through its `⧉▾` menu. */
async function popOutSecond(page: Page): Promise<void> {
  await pane(page, 'home').nth(1).getByRole('button', { name: 'Pop out' }).click();
  await page.getByRole('menuitem', { name: 'This pane', exact: true }).click();
  await expect(floatOf(page, 'home')).toBeVisible();
}

/** Drags the float's title bar by {@link dx} pixels and answers the float's box afterwards. */
async function dragFloat(page: Page, dx: number): Promise<{ moved: number; box: Box }> {
  const float = floatOf(page, 'home');
  const before = await boxOf(float);
  await dragFrom(page, grabOf(await boxOf(titleBar(float))), { x: dx, y: 0 });
  const box = await boxOf(float);
  return { moved: box.x - before.x, box };
}

test('the buttons split a pane, pop it out, and a float drags and docks', async ({ page }) => {
  await signIn(page);
  await splitWithHome(page);
  await popOutSecond(page);
  await expect(pane(page, 'home')).toHaveCount(2);
  const first = await dragFloat(page, DRAG);
  expect(Math.abs(first.moved - DRAG)).toBeLessThan(1);
  expectInsideViewport(page, first.box);
  const far = await dragFloat(page, DRAG * 6);
  expect(far.moved).toBeGreaterThan(0);
  expectInsideViewport(page, far.box);
  await floatOf(page, 'home')
    .getByRole('button', { name: /^Dock / })
    .click();
  await expect(floatOf(page, 'home')).toHaveCount(0);
  await expect(pane(page, 'home')).toHaveCount(2);
});

test('Existing window… lists the other windows and floats the one picked', async ({ page }) => {
  await routeTags(page);
  await signIn(page);
  await submit(page, '/tag rust');
  await expect(pane(page, 'home')).toHaveCount(0);
  await pane(page, '#rust').getByRole('button', { name: 'Pop out' }).click();
  await page.getByRole('menuitem', { name: 'Existing window…', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '‹ Back', exact: true })).toBeFocused();
  await page.getByRole('menuitem', { name: /^\d+ · home$/u }).click();
  await expect(floatOf(page, 'home')).toBeVisible();
  await expect(pane(page, '#rust')).toBeVisible();
});

test('Hashtag… asks for the tag in a dialog, then splits with that tag', async ({ page }) => {
  await routeTags(page);
  await signIn(page);
  await page.getByRole('button', { name: 'Split side by side' }).click();
  await page.getByRole('menuitem', { name: 'Hashtag…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Split with hashtag' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox').fill('rust');
  await dialog.getByRole('combobox').press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(pane(page, 'home')).toHaveCount(1);
  await expect(pane(page, '#rust')).toHaveCount(1);
  await expect(pane(page, '#rust')).toHaveAttribute('aria-current', 'true');
});

/** The divider of the one split on the desktop. */
function dividerOf(page: Page): Locator {
  return page.getByRole('separator', { name: 'Resize panes' });
}

test('dragging a divider resizes the panes', async ({ page }) => {
  await signIn(page);
  await submit(page, '/vsplit');
  await expect(pane(page, 'home')).toHaveCount(2);
  const left = pane(page, 'home').first();
  const before = await boxOf(left);
  await dragFrom(page, centerOf(await boxOf(dividerOf(page))), { x: DRAG, y: 0 });
  const after = await boxOf(left);
  expect(after.width - before.width).toBeGreaterThan(DRAG * 0.8);
  expect(after.width - before.width).toBeLessThan(DRAG * 1.2);
  await expect(dividerOf(page)).not.toHaveAttribute('aria-valuenow', '50');
});

test('the arrow keys resize the panes from a focused divider', async ({ page }) => {
  await signIn(page);
  await submit(page, '/vsplit');
  const divider = dividerOf(page);
  await expect(divider).toHaveAttribute('aria-valuenow', '50');
  const before = await boxOf(pane(page, 'home').first());
  await divider.focus();
  await expect(divider).toBeFocused();
  await divider.press('ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '55');
  expect((await boxOf(pane(page, 'home').first())).width).toBeGreaterThan(before.width);
  await divider.press('ArrowLeft');
  await divider.press('ArrowLeft');
  await expect(divider).toHaveAttribute('aria-valuenow', '45');
});

test('Home and End send a focused divider to its limits', async ({ page }) => {
  await signIn(page);
  await submit(page, '/vsplit');
  const divider = dividerOf(page);
  await divider.press('End');
  await expect(divider).toHaveAttribute('aria-valuenow', '90');
  await divider.press('Home');
  await expect(divider).toHaveAttribute('aria-valuenow', '10');
});
