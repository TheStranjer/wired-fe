/**
 * The posting-account hotkey and click (WFE-285): in a feed pane, Shift+A in
 * navigation mode opens the `Post as` dialog, and after it is closed the
 * status-line entry opens it again.
 */

import { expect, test } from '@playwright/test';

import { showWindow, signIn } from './fixtures/session';

test('Shift+A and the status-line entry open the account picker', async ({ page }) => {
  await signIn(page);
  await showWindow(page, '~stream', 'feed');
  const dialog = page.getByRole('dialog', { name: 'Post as' });

  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+A');

  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: /^Posting as @.*, change$/u }).click();

  await expect(dialog).toBeVisible();
});
