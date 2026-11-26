/**
 * The account picker (WFE-282): in a feed pane, bare `/postas` raises the
 * `Post as` dialog over the shell with focus on the chosen account, offering
 * the feed and everywhere as the places to remember the choice, and Escape
 * closes it and gives the keyboard back to the command line. With a single
 * account, plain text in a feed posts at once (WFE-284); the two-account
 * picker flow is covered in Vitest, since the fixtures sign in one account.
 */

import { expect, test } from '@playwright/test';

import { showWindow, signIn, submit } from './fixtures/session';

/** The title of the stream feed's window: its name behind a tilde. */
const STREAM = '~stream';

test('/postas opens the picker with focus inside, and Escape returns focus to the command line', async ({
  page,
}) => {
  await signIn(page);
  await showWindow(page, STREAM, 'feed');

  await submit(page, '/postas');

  const dialog = page.getByRole('dialog', { name: 'Post as' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio', { name: /^1\. @/u })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: /^1\. @/u })).toBeFocused();
  await expect(dialog.getByRole('radio', { name: 'For this feed (~stream)' })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: 'Everywhere' })).not.toBeChecked();

  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Command line' })).toBeFocused();
});

test('Enter on a radio submits, saving the default and printing it', async ({ page }) => {
  await signIn(page);
  await showWindow(page, STREAM, 'feed');
  await submit(page, '/postas');
  const dialog = page.getByRole('dialog', { name: 'Post as' });
  await expect(dialog.getByRole('radio', { name: /^1\. @/u })).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('log', { name: 'feed' })).toContainText('~stream posts as @lain@');
});

test('with one account signed in, plain text in a feed posts at once, with no modal', async ({
  page,
}) => {
  await signIn(page);
  await showWindow(page, STREAM, 'feed');

  await submit(page, 'hello');

  await expect(page.getByRole('log', { name: 'feed' })).toContainText('posted as @lain@');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
