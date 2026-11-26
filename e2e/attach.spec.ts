/**
 * `/attach` reached by hotkey and by pane menu in the built bundle (WFE-288,
 * decision 6): `Shift+I` in navigation mode, `Ctrl+B I` and the `Attach
 * media…` row of the split menu each open the browser's file chooser.
 */

import { expect, test } from '@playwright/test';

import { signIn } from './fixtures/session';
import { press } from './fixtures/tiling';

test('Shift+I in navigation mode opens the file chooser', async ({ page }) => {
  await signIn(page);
  await press(page, 'Escape');
  await expect(page.getByText('[NAV]', { exact: true })).toBeVisible();

  const chooser = page.waitForEvent('filechooser');
  await press(page, 'Shift+I');

  expect((await chooser).isMultiple()).toBe(true);
});

test('Ctrl+B I opens the file chooser', async ({ page }) => {
  await signIn(page);

  const chooser = page.waitForEvent('filechooser');
  await press(page, 'Control+b', 'Shift+I');

  await chooser;
});

test('the Attach media… row of the split menu opens the file chooser', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Split side by side' }).first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Attach media…' }).click();

  await chooser;
});
