/**
 * The whole first session against the fake Wired instance (decisions 3, 5, 6
 * and 8, e2e/fixtures/wired): `/connect` walks the OAuth redirect back, the
 * status window reports the login, the home window shows the fixture posts,
 * and plain text on the command line becomes a post at the bottom of home —
 * all of it with the console as silent as in ./boot.spec.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { HANDLE, ORIGIN, POSTED_TEXT, routeWired } from './fixtures/wired';

/** The path decision 5 probes and Wired answers 404: the absent v2 document. */
const V2_PROBE = '/api/v2/instance';

/**
 * Console errors and page exceptions, collected the way ./boot.spec does,
 * except the one 404 the flow must produce: connect probes
 * `/api/v2/instance` and Wired has no v2 document (decision 5 treats the 404
 * as its absence), which the browser logs as a failed resource load.
 */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.location().url.endsWith(V2_PROBE)) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  return errors;
}

/** The shell's command line. */
function commandLine(page: Page): Locator {
  return page.getByRole('textbox', { name: 'Command line' });
}

/** Types {@link text} into the command line and submits it with Enter. */
async function submit(page: Page, text: string): Promise<void> {
  const line = commandLine(page);
  await line.fill(text);
  await line.press('Enter');
}

/** The window entry the status line lists as {@link name}, e.g. "Window 2: home". */
function windowEntry(page: Page, name: string): Locator {
  return page.getByRole('button', { name });
}

/** The home window's scrollback, wherever the app shows it. */
function homeLog(page: Page): Locator {
  return page.getByRole('log', { name: 'home' });
}

/** Boots to a logged-out shell and runs `/connect` through the OAuth redirect. */
async function connect(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('log', { name: 'status' }).getByText('Not connected. Type /connect to log in.'),
  ).toBeVisible();
  await submit(page, '/connect');
}

/** Reads the loaded home window, then the login line in the status window. */
async function readWindows(page: Page): Promise<void> {
  const home = homeLog(page);
  await expect(home.getByText('She is here.')).toBeVisible();
  await expect(home.getByText('the LAN is all one network')).toBeVisible();
  await expect(home.locator('article')).toHaveCount(2);
  await windowEntry(page, 'Window 1: status').click();
  await expect(
    page.getByRole('log', { name: 'status' }).getByText(`Logged in to ${ORIGIN} as @${HANDLE}`),
  ).toBeVisible();
  await windowEntry(page, 'Window 2: home').click();
}

/** Posts {@link POSTED_TEXT} from the home window and sees it at the bottom. */
async function postFromHome(page: Page): Promise<void> {
  await submit(page, POSTED_TEXT);
  const home = homeLog(page);
  await expect(home.locator('article')).toHaveCount(3);
  await expect(home.locator('article').last()).toContainText(POSTED_TEXT);
}

test('connect, log in, read home, post', async ({ page }) => {
  const errors = watchErrors(page);
  await routeWired(page);

  await connect(page);
  await readWindows(page);
  await postFromHome(page);

  await page.screenshot({ path: 'test-results/login-home.png' });
  expect(errors).toStrictEqual([]);
});
