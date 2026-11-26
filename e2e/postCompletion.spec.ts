/**
 * Completion in the composer's text (WFE-302): typing `@a` in the text box of
 * `/composer` lists an account the home window showed with its display name,
 * Tab completes it and the box keeps focus; with no list on show Tab moves
 * focus on to the next control, so the keyboard is never trapped in the box;
 * Escape closes the list without leaving the box.
 */

import { expect, test } from '@playwright/test';

import { signIn, submit } from './fixtures/session';

test('Tab completes a handle in the composer, and moves focus on once nothing is listed', async ({
  page,
}) => {
  await signIn(page);
  await submit(page, '/composer');

  const text = page.getByRole('textbox', { name: 'Post text' });
  await text.fill('@a');

  await expect(page.getByRole('option', { name: '@alice — Alice' })).toBeVisible();

  await text.press('Tab');

  await expect(text).toHaveValue('@alice ');
  await expect(text).toBeFocused();

  await text.pressSequentially(' ');
  await text.press('Tab');

  await expect(text).not.toBeFocused();
  await expect(text).toHaveValue('@alice  ');
});

test('Escape closes the list and the text box keeps focus', async ({ page }) => {
  await signIn(page);
  await submit(page, '/composer');

  const text = page.getByRole('textbox', { name: 'Post text' });
  await text.fill('@a');
  await expect(page.getByRole('option', { name: '@alice — Alice' })).toBeVisible();

  await text.press('Escape');

  await expect(page.getByRole('listbox', { name: 'Post suggestions' })).toHaveCount(0);
  await expect(text).toBeFocused();
  await expect(text).toHaveValue('@a');
});
