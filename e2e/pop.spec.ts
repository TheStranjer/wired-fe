/**
 * Double-clicking a post pops its thread into a float (WFE-241), but never a
 * thread out of itself (WFE-291): a double-click on a post inside that float
 * leaves one float and one pane named after the thread, and says so.
 */

import { expect, test, type Page } from '@playwright/test';

import { logRegion, signIn, watchErrors } from './fixtures/session';
import { floatOf, pane } from './fixtures/tiling';

/** The words of the post popped from home, and of its ancestor and a reply in the thread. */
const POPPED = 'She is here.';
const ANCESTOR = 'close the world. open your eyes.';
const REPLY = 'the wired is everywhere, all at once.';

/** The title the thread of the home post {@link POPPED} gets, from the label its card carries. */
async function threadTitle(page: Page): Promise<string> {
  const card = logRegion(page, 'home').getByRole('article').filter({ hasText: POPPED });
  const label = /^Post (\S+) by /u.exec((await card.getAttribute('aria-label')) ?? '')?.[1];
  return `thread/${label ?? ''}`;
}

test('double-clicking a post inside a thread float opens no second float', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  const title = await threadTitle(page);

  await logRegion(page, 'home').getByText(POPPED).dblclick();
  await expect(floatOf(page, title)).toHaveCount(1);
  const thread = logRegion(page, title);
  await expect(thread.locator('article')).toHaveCount(4);

  await thread.getByText(REPLY).dblclick();
  await expect(thread.getByText('Already in this thread')).toHaveCount(1);
  await thread.getByText(ANCESTOR).dblclick();
  await expect(thread.getByText('Already in this thread')).toHaveCount(2);

  await expect(floatOf(page, title)).toHaveCount(1);
  await expect(pane(page, title)).toHaveCount(1);
  expect(errors).toStrictEqual([]);
});
