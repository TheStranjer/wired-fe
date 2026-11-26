/**
 * The view list of an empty desktop (WFE-298): a click on a view opens it as
 * the desktop's first pane, with no command typed.
 */

import { expect, test } from '@playwright/test';

import { signIn, submit } from './fixtures/session';
import { desktopButton, pane } from './fixtures/tiling';

test('clicking a view on an empty desktop opens it as the only pane', async ({ page }) => {
  await signIn(page);
  await submit(page, '/desktop 2');
  await expect(desktopButton(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText(/^empty desktop/u)).toBeVisible();

  await page
    .getByRole('toolbar', { name: 'Open a view' })
    .getByRole('button', { name: 'Home' })
    .click();

  await expect(pane(page, 'home')).toHaveCount(1);
  await expect(page.getByText(/^empty desktop/u)).toBeHidden();
});
