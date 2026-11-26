/**
 * The live command suggestion list (WFE-297): typing `/ho` lists `/home` with
 * its summary above the command line while the input keeps focus, Tab
 * completes the line to `/home `, and a click on a row completes to it too.
 */

import { expect, test } from '@playwright/test';

import { signIn } from './fixtures/session';

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
