/**
 * Quoting from a feed pane (WFE-262): in the custom `~stream` feed, a post
 * card's `⋯` → Quote opens a composer pane bound to the post instead of filling
 * the command line (a feed takes no plain-text posts, so that line would be
 * refused with "You can't post in this window"); typing and sending creates the
 * status with a `quote_id` and no error anywhere.
 */

import { expect, test, type Page } from '@playwright/test';

import { logRegion, showWindow, signIn, watchErrors } from './fixtures/session';
import { pane } from './fixtures/tiling';

/** The title of the stream feed's window: its name behind a tilde. */
const STREAM = '~stream';

/** The text typed into the quote composer. */
const COMMENT = 'quoting the wired';

/** Collects the JSON body of every status create the page sends. */
function watchCreates(page: Page): unknown[] {
  const created: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/statuses')) {
      created.push(request.postDataJSON());
    }
  });
  return created;
}

/** The first card of the stream: `⋯` → Quote on it. */
async function quoteFirstCard(page: Page): Promise<void> {
  const card = pane(page, STREAM)
    .getByRole('article', { name: /^Post \S+ by / })
    .first();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /^More actions for post / }).click();
  await page.getByRole('menuitem', { name: 'Quote' }).click();
}

/** The quote composer shows the quoted post; {@link COMMENT} is typed and sent. */
async function sendQuote(page: Page): Promise<void> {
  const composer = pane(page, 'compose');
  await expect(composer.getByText(/^Quoting @/u)).toBeVisible();
  await composer.getByRole('textbox', { name: 'Post text' }).fill(COMMENT);
  await composer.getByRole('button', { name: '[ send ]' }).click();
  await expect(pane(page, 'compose')).toHaveCount(0);
}

test('Quote from a feed card opens a composer, and sending creates the quote', async ({ page }) => {
  const errors = watchErrors(page);
  const created = watchCreates(page);
  await signIn(page);
  await showWindow(page, STREAM, 'feed');

  await quoteFirstCard(page);
  await sendQuote(page);

  await showWindow(page, 'status');
  await expect(logRegion(page, 'status')).toContainText('❝ quoted @');
  await expect(logRegion(page, 'status')).not.toContainText("can't post");
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ status: COMMENT });
  expect(created[0]).toHaveProperty('quote_id');
  expect(errors).toStrictEqual([]);
});
