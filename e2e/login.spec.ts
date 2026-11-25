/**
 * The whole first session against the fake Wired instance (decisions 3, 5, 6
 * and 8, e2e/fixtures/wired): `/connect` walks the OAuth redirect back, startup
 * has opened a home and a notifications window for the account and the home
 * window shows the fixture posts, and plain text on the command line becomes a
 * post at the bottom of home — all of it with the console as silent as in
 * ./boot.spec. Getting logged in is e2e/fixtures/session's job; this spec is
 * what the shell does with the session it hands over.
 */

import { expect, test, type Page } from '@playwright/test';

import { POSTED_TEXT } from './fixtures/content';
import { logRegion, signIn, submit, watchErrors } from './fixtures/session';

/** The two posts the fixture's home timeline serves, oldest first on screen. */
const FIXTURE_POSTS = ['She is here.', 'the LAN is all one network'];

/** Reads home, the window the login left the reader on: the fixture posts. */
async function readHome(page: Page): Promise<void> {
  const home = logRegion(page, 'home');
  await expect(home.locator('article')).toHaveCount(FIXTURE_POSTS.length);
  for (const text of FIXTURE_POSTS) {
    await expect(home.getByText(text)).toBeVisible();
  }
}

/** Posts {@link POSTED_TEXT} from the home window and sees it at the bottom. */
async function postFromHome(page: Page): Promise<void> {
  await submit(page, POSTED_TEXT);
  const home = logRegion(page, 'home');
  await expect(home.locator('article')).toHaveCount(FIXTURE_POSTS.length + 1);
  await expect(home.locator('article').last()).toContainText(POSTED_TEXT);
}

test('connect, log in, read home, post', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);

  await expect(page.getByRole('button', { name: 'Desktop 1, active' })).toBeVisible();
  await readHome(page);
  await postFromHome(page);

  await page.screenshot({ path: 'test-results/login-home.png' });
  expect(errors).toStrictEqual([]);
});
