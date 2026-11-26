/**
 * The dock button of a float (WFE-312): drawn `⇲`, and its tooltip names the
 * `/dock` command so the way back into the tiles can be found by hovering.
 */

import { expect, test } from '@playwright/test';

import { signIn } from './fixtures/session';
import { floatOf, pane } from './fixtures/tiling';

test("a float's dock button is ⇲ and its tooltip names /dock", async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Split side by side' }).click();
  await page.getByRole('menuitem', { name: 'Home', exact: true }).click();
  await pane(page, 'home')
    .nth(1)
    .getByRole('button', { name: /^Float / })
    .click();
  const dock = floatOf(page, 'home').getByRole('button', { name: /^Dock / });
  await expect(dock).toHaveText('⇲');
  await expect(dock).toHaveAttribute('title', /\/dock/u);
});
