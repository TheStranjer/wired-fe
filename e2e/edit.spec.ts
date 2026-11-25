/**
 * Editing from a card's menu (WFE-268): on one of the account's own posts —
 * lain's in the `/thread a0` conversation — `⋯` → Edit opens a composer pane
 * bound to the post and holding its source text instead of filling `/edit a3`
 * into the command line; changing the text and sending saves the edit, so the
 * card shows the new text and `(edited)` and the composer is gone.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { logRegion, showWindow, signIn, submit, watchErrors } from './fixtures/session';
import { pane } from './fixtures/tiling';

/** The text lain's post in the thread says, and what it is changed to. */
const ORIGINAL = 'the wired is everywhere, all at once.';
const REWRITTEN = 'the wired is everywhere, edited.';

/** The card of lain's own post in the thread window. */
function ownCard(page: Page): Locator {
  return logRegion(page, 'thread/a0').getByRole('article').filter({ hasText: ORIGINAL });
}

/** `⋯` → Edit on lain's card opens the composer, which holds the post's text. */
async function openEditComposer(page: Page): Promise<void> {
  await submit(page, '/thread a0');
  await showWindow(page, 'thread/a0');
  await expect(ownCard(page)).toBeVisible();
  await ownCard(page)
    .getByRole('button', { name: /^More actions for post / })
    .click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const composer = pane(page, 'compose');
  await expect(composer.getByText(/^editing \[[a-z]\d\]: /u)).toBeVisible();
  await expect(composer.getByRole('textbox', { name: 'Post text' })).toHaveValue(ORIGINAL);
  await expect(composer.getByRole('combobox', { name: 'Visibility' })).toBeDisabled();
}

test('Edit from a card menu opens a bound composer, and sending shows the edit', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await signIn(page);

  await openEditComposer(page);
  const composer = pane(page, 'compose');
  await composer.getByRole('textbox', { name: 'Post text' }).fill(REWRITTEN);
  await composer.getByRole('button', { name: '[ send ]' }).click();

  await expect(pane(page, 'compose')).toHaveCount(0);
  await expect(ownCard(page)).toHaveCount(0);
  const edited = logRegion(page, 'thread/a0').getByRole('article').filter({ hasText: REWRITTEN });
  await expect(edited).toBeVisible();
  await expect(edited).toContainText('(edited)');
  expect(errors).toStrictEqual([]);
});
