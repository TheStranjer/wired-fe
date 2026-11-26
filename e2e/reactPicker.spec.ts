/**
 * The card's `☺` button opens the emoji picker (WFE-265): click it, search,
 * choose, and the reaction chip appears under the post through the one
 * `/react` path, while the command line stays empty and focus is back on the
 * button. The Unicode list is a chunk of its own, fetched when the picker
 * first opens, and it must load under the build's CSP without console errors.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { logRegion, signIn, watchErrors } from './fixtures/session';

/** The `☺` button of the first post of home. */
function reactButton(page: Page): Locator {
  return logRegion(page, 'home').getByRole('button', { name: 'React to post a0' });
}

/** The open picker of the first post. */
function picker(page: Page): Locator {
  return page.getByRole('dialog', { name: 'React to [a0]' });
}

/** The 🔥 button of the picker, named by its Unicode name. */
function fire(page: Page): Locator {
  return picker(page).getByRole('button', { name: 'fire', exact: true });
}

/** Open the picker and search for the one emoji `fire hot` finds, once the list has loaded. */
async function searchFire(page: Page): Promise<void> {
  await reactButton(page).click();
  await picker(page).getByRole('searchbox').fill('fire hot');
  await expect(fire(page)).toBeVisible();
}

/** The chip a 🔥 reaction leaves under the first post, and the empty command line. */
async function expectFireReaction(page: Page): Promise<void> {
  await expect(logRegion(page, 'home').getByRole('img', { name: '🔥, 1 reaction' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Command line' })).toHaveValue('');
}

test('reacts to a post through the emoji picker without touching the command line', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await signIn(page);

  await reactButton(page).click();
  await expect(picker(page)).toBeVisible();
  await expect(picker(page).getByRole('searchbox', { name: 'Search emoji' })).toBeFocused();
  await picker(page).getByRole('searchbox').fill('fire');
  await picker(page).getByRole('button', { name: 'fire', exact: true }).click();

  await expect(picker(page)).toHaveCount(0);
  await expect(reactButton(page)).toBeFocused();
  await expect(logRegion(page, 'home')).toContainText('🔥 reacted to [a0]');
  await expectFireReaction(page);
  expect(errors).toStrictEqual([]);
});

test('closes the picker with Escape and returns focus to the button', async ({ page }) => {
  await signIn(page);

  await searchFire(page);
  await page.keyboard.press('ArrowDown');
  await expect(fire(page)).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(picker(page)).toHaveCount(0);
  await expect(reactButton(page)).toBeFocused();
});

test('chooses from the picker with the keyboard', async ({ page }) => {
  await signIn(page);

  await searchFire(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expectFireReaction(page);
});
