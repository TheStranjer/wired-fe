/**
 * The dialogs behind a card's `⋯` → Delete, Block and Mute (WFE-266, WFE-267):
 * choosing Delete on one of your own posts asks first, and confirming removes
 * the card; choosing Block on someone else's asks too, and cancelling leaves
 * the thread exactly as it was and sends nothing to the instance; choosing Mute
 * asks how long, and 1 hour mutes the author for 1h.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { logRegion, showWindow, signIn, submit, watchErrors } from './fixtures/session';
import { json } from './fixtures/wire';

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

/** Answers every `POST …/accounts/<id>/mute` as a mute, recording each request body. */
async function routeMute(page: Page): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await page.route('**/api/v1/accounts/*/mute', async (route) => {
    bodies.push(route.request().postDataJSON());
    await json(route, { id: 'AhZalic3Acc00000000000001', muting: true });
  });
  return bodies;
}

/** Opens alice's mute dialog from her card in {@link log}, checking it starts at Forever. */
async function openMuteDialog(page: Page, log: Locator): Promise<Locator> {
  await chooseRow(
    page,
    log.getByRole('article').filter({ hasText: 'She is here.' }),
    'Mute author',
  );
  const dialog = page.getByRole('dialog', { name: /^Mute @alice@\S+\?$/ });
  await expect(dialog.getByRole('radio', { name: 'Forever' })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: 'Forever' })).toBeFocused();
  return dialog;
}

test('Mute from the menu asks how long, and 1 hour mutes for 1h', async ({ page }) => {
  const errors = watchErrors(page);
  const bodies = await routeMute(page);
  await signIn(page);
  const log = await openThread(page);

  const dialog = await openMuteDialog(page, log);
  await dialog.getByRole('radio', { name: '1 hour' }).check();
  await dialog.getByRole('button', { name: 'Mute' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(log).toContainText(/muted @alice\S* for 1h/u);
  expect(bodies).toStrictEqual([{ duration: 3600 }]);
  expect(errors).toStrictEqual([]);
});
