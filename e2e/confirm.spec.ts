/**
 * The confirmation behind a card's `⋯` → Delete and Block (WFE-266): choosing
 * Delete on one of your own posts asks first, and confirming removes the card;
 * choosing Block on someone else's asks too, and cancelling leaves the thread
 * exactly as it was and sends nothing to the instance.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { logRegion, showWindow, signIn, submit, watchErrors } from './fixtures/session';

/** The thread window the specs open from home: four posts, two of them lain's own. */
const THREAD = 'thread/a0';

/** The words of lain's own post, the thread's ancestor. */
const OWN_WORDS = 'close the world. open your eyes.';

/** Opens {@link THREAD} and returns its scrollback. */
async function openThread(page: Page): Promise<Locator> {
  await submit(page, '/thread a0');
  await showWindow(page, THREAD);
  const log = logRegion(page, THREAD);
  await expect(log.locator('article')).toHaveCount(4);
  return log;
}

/** The `⋯` menu of {@link card}, with the row named {@link row} chosen. */
async function chooseRow(page: Page, card: Locator, row: string): Promise<void> {
  await card.getByRole('button', { name: /^More actions for post / }).click();
  await page.getByRole('menuitem', { name: row }).click();
}

test('Delete from the menu asks first, and confirming removes the card', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  const log = await openThread(page);

  await chooseRow(page, log.getByRole('article').filter({ hasText: OWN_WORDS }), 'Delete');
  const dialog = page.getByRole('dialog', { name: /^Delete post \[\S+\]\?$/ });
  await expect(dialog).toContainText(`This can't be undone. "${OWN_WORDS}"`);
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(log.locator('article')).toHaveCount(3);
  await expect(log.getByText(OWN_WORDS)).toHaveCount(0);
  expect(errors).toStrictEqual([]);
});

test('Block from the menu asks first, and cancelling changes nothing', async ({ page }) => {
  const errors = watchErrors(page);
  const blocks: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/block')) {
      blocks.push(request.url());
    }
  });
  await signIn(page);
  const log = await openThread(page);

  await chooseRow(
    page,
    log.getByRole('article').filter({ hasText: 'She is here.' }),
    'Block author',
  );
  const dialog = page.getByRole('dialog', { name: /^Block @alice@\S+\?$/ });
  await expect(dialog).toContainText('their posts are hidden');
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(log.locator('article')).toHaveCount(4);
  expect(blocks).toStrictEqual([]);
  expect(errors).toStrictEqual([]);
});
