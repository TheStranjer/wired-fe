/**
 * Making desktops (WFE-272, decisions 12 and 18): stepping right past the last
 * desktop makes one only while the last holds something. Past an empty one the
 * hotkey is refused with the error line and its alert, and no desktop piles up.
 */

import { expect, test } from '@playwright/test';

import { alertOf } from './fixtures/alert';
import { signIn } from './fixtures/session';
import { desktopButton, press } from './fixtures/tiling';

test('Alt+] makes one desktop and is then refused past the empty one', async ({ page }) => {
  await signIn(page);

  await press(page, 'Alt+]', 'Alt+]');

  const alert = alertOf(page);
  await expect(alert).toBeVisible();
  await expect(alert).toHaveAccessibleDescription(
    'Desktop 2 is empty: put something on it before making another',
  );
  await expect(desktopButton(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(desktopButton(page, 3)).toHaveCount(0);

  await page.keyboard.press('Enter');

  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Command line' })).toBeFocused();
  await expect(desktopButton(page, 3)).toHaveCount(0);
});
