/**
 * A permalink opened with no account (WFE-340, decisions 4 and 13): the
 * visitor reads the post and its replies in a read-only window under the
 * instance's signed-out key, and favouriting by the card's button, by `/fav` and
 * by the hotkey is each refused with the one sign-in message, with no write and
 * no `Authorization` header sent. Where the instance restricts the read the
 * visitor gets the `/connect` hint and the link stays in the address bar.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { THREAD_ROOT_ID } from './fixtures/content';
import { logRegion, submit, watchErrors } from './fixtures/session';
import { pane, press } from './fixtures/tiling';
import { json } from './fixtures/wire';
import { routeWired } from './fixtures/wired';

const TITLE = `thread/${THREAD_ROOT_ID}`;
const REFUSAL = 'Sign in to do that: this window is read-only. Type /connect to log in.';

/** The `NodeInfo` an instance restricting what visitors read publishes, in Pleroma's own terms (true is restricted). */
const RESTRICTED_NODEINFO = {
  version: '2.1',
  software: { name: 'wired', version: '0.1.0' },
  metadata: {
    nodeName: 'The Wired',
    features: ['pleroma_api', 'quote_posting', 'editing'],
    restrict_unauthenticated: {
      activities: { local: true, remote: true },
      profiles: { local: true, remote: true },
      timelines: { local: true, federated: true },
    },
  },
};

/**
 * Opens the permalink of the fixture thread with no account, and answers the
 * requests the page sent that a visitor must never send: any write, and any
 * carrying an `Authorization` header.
 */
async function openAsVisitor(page: Page): Promise<readonly string[]> {
  const sent: string[] = [];
  page.on('request', (request) => {
    const signed = 'authorization' in request.headers();
    if (request.url().includes('/api/') && (request.method() !== 'GET' || signed)) {
      sent.push(`${request.method()} ${request.url()}`);
    }
  });
  await routeWired(page);
  await page.goto(`/#/notice/${THREAD_ROOT_ID}`);
  await expect(logRegion(page, TITLE).getByText('She is here.')).toBeVisible();
  return sent;
}

/** The sign-in refusals printed into the thread window. */
function refusals(page: Page): Locator {
  return logRegion(page, TITLE).getByText(REFUSAL);
}

/** The favourite button of the first card. */
function favourite(page: Page): Locator {
  return page.getByRole('button', { name: /^Favourite post / }).first();
}

test('a visitor with no account reads the post and its replies, read-only', async ({ page }) => {
  const errors = watchErrors(page);
  const sent = await openAsVisitor(page);

  const thread = logRegion(page, TITLE);
  await expect(thread.getByText('close the world. open your eyes.')).toBeVisible();
  await expect(thread.getByText('the wired is everywhere, all at once.')).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.getByText('Sign in to reply. Type /connect to log in.')).toBeVisible();
  await expect(pane(page, TITLE).getByRole('textbox', { name: 'Post text' })).toHaveCount(0);
  await expect(favourite(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(favourite(page)).toHaveAttribute('aria-description', 'Sign in to use this action');
  expect(sent).toStrictEqual([]);
  expect(errors).toStrictEqual([]);
});

test('favouriting from the card button is refused with the sign-in message', async ({ page }) => {
  const sent = await openAsVisitor(page);

  // The button is aria-disabled, which Playwright treats as not actionable; a visitor can still press it.
  await favourite(page).click({ force: true });

  await expect(refusals(page)).toHaveCount(1);
  expect(sent).toStrictEqual([]);
});

test('favouriting with /fav is refused with the sign-in message', async ({ page }) => {
  const sent = await openAsVisitor(page);

  await submit(page, '/fav a0');

  await expect(refusals(page)).toHaveCount(1);
  expect(sent).toStrictEqual([]);
});

test('favouriting with the hotkey is refused with the sign-in message', async ({ page }) => {
  const sent = await openAsVisitor(page);

  await press(page, 'Escape', 'f');

  await expect(refusals(page)).toHaveCount(1);
  expect(sent).toStrictEqual([]);
});

test('an instance that restricts the read gets the /connect hint and keeps the link', async ({
  page,
}) => {
  await routeWired(page);
  await page.route('**/nodeinfo/2.1', async (route) => {
    await json(route, RESTRICTED_NODEINFO);
  });

  await page.goto(`/#/notice/${THREAD_ROOT_ID}`);

  await expect(logRegion(page, 'status')).toContainText('Not connected. Type /connect to log in.');
  await expect(logRegion(page, TITLE)).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe(`#/notice/${THREAD_ROOT_ID}`);
});
