/**
 * The live command suggestion list (WFE-297): typing `/ho` lists `/home` with
 * its summary above the command line while the input keeps focus, Tab
 * completes the line to `/home `, and a click on a row completes to it too.
 * Typing `@a` lists an account the home window showed with its display name
 * (WFE-300), and Tab completes it. The list scrolls (WFE-306): the wheel over
 * it reaches the last command without moving the scrollback behind it.
 */

import { expect, test } from '@playwright/test';

import { logRegion, signIn, submit } from './fixtures/session';

/** The row the registry gives `/home`. */
const HOME_ROW = '/home — Open your home timeline';

test('typing /ho lists /home with its summary and Tab completes the line', async ({ page }) => {
  await signIn(page);

  const line = page.getByRole('combobox', { name: 'Command line' });
  await line.fill('/ho');

  await expect(page.getByRole('option', { name: HOME_ROW })).toBeVisible();
  await expect(line).toHaveAttribute('aria-expanded', 'true');

  await line.press('Tab');

  await expect(line).toHaveValue('/home ');
  await expect(page.getByRole('option', { name: HOME_ROW })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(line).toBeFocused();
});

test('a click on a row completes to it and the input keeps focus', async ({ page }) => {
  await signIn(page);

  const line = page.getByRole('combobox', { name: 'Command line' });
  await line.fill('/ho');
  await page.getByRole('option', { name: HOME_ROW }).click();

  await expect(line).toHaveValue('/home ');
  await expect(line).toBeFocused();
  await expect(page.getByRole('option')).toHaveCount(0);
});

test('typing @a lists a seen account with its display name and Tab completes it', async ({
  page,
}) => {
  await signIn(page);

  const line = page.getByRole('combobox', { name: 'Command line' });
  await line.fill('@a');

  const row = page.getByRole('option', { name: '@alice — Alice' });
  await expect(row).toBeVisible();

  await line.press('Tab');

  await expect(line).toHaveValue('@alice ');
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await expect(line).toBeFocused();
});

test('the list scrolls with the wheel to reach every command and the pane behind stays put', async ({
  page,
}) => {
  await signIn(page);
  await submit(page, '/win 1');
  for (let count = 0; count < 30; count += 1) {
    await submit(page, '/nosuchcommand');
  }
  const log = logRegion(page, 'status');
  await log.evaluate((element) => {
    element.scrollTo(0, 0);
  });

  await page.getByRole('combobox', { name: 'Command line' }).fill('/');
  const options = page.getByRole('option');
  const last = options.last();
  await expect(options.nth(9)).not.toBeInViewport();

  const box = await page.getByRole('listbox', { name: 'Command suggestions' }).boundingBox();
  await page.mouse.move((box?.x ?? 0) + 20, (box?.y ?? 0) + 20);
  await page.mouse.wheel(0, 5000);

  await expect(last).toBeInViewport();
  expect(await log.evaluate((element) => element.scrollTop)).toBe(0);
});
