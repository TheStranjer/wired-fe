/**
 * Post labels on the command line (WFE-301): in a timeline, `/fav ` lists the
 * window's labels with the author and first words of each post, and Tab fills
 * the newest label into the line while the list stays up on its row.
 */

import { expect, test } from '@playwright/test';

import { signIn } from './fixtures/session';

/** A row of the list: a label, then the author in angle brackets and the words. */
const LABEL_ROW = /^[a-z]\d — <@[^>]+> \S/u;

test('/fav and Tab fill a label in, and the list shows who wrote the post', async ({ page }) => {
  await signIn(page);

  const line = page.getByRole('combobox', { name: 'Command line' });
  await line.fill('/fav ');

  const rows = page.getByRole('option');
  await expect(rows.first()).toHaveText(LABEL_ROW);
  await expect(line).toHaveAttribute('aria-expanded', 'true');

  await line.press('Tab');

  await expect(line).toHaveValue(/^\/fav [a-z]\d $/u);
  await expect(page.getByRole('option', { selected: true })).toHaveText(LABEL_ROW);
  await expect(line).toBeFocused();
});
