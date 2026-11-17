/**
 * The session every end-to-end spec starts from: a fake instance of ./wired,
 * ./mastodon or ./pleroma under the built bundle, `/connect` walked through the
 * OAuth redirect (decision 8), and the locators the specs share — the command
 * line, the status line's window entries, a window's log region — over the two
 * hotkey modes (AGENTS.md "Two hotkey modes"). The assertions stay in the
 * specs; this module only gets the reader logged in and moves them between
 * windows.
 */

import { expect, type Locator, type Page } from '@playwright/test';

import { HANDLE } from './content';
import { routeMastodon } from './mastodon';
import { routePleroma } from './pleroma';
import { HOST, ORIGIN } from './wire';
import { routeWired } from './wired';

/** One fake instance to sign in to: its routes, and the handle it proves. */
export type Instance = {
  readonly route: (page: Page) => Promise<void>;
  readonly handle: string;
};

/** The three backends the specs run the same flow against (decision 5). */
export const WIRED: Instance = { route: routeWired, handle: HANDLE };
export const MASTODON: Instance = {
  route: routeMastodon,
  handle: `lain@${new URL(ORIGIN).hostname}`,
};
export const PLEROMA: Instance = { route: routePleroma, handle: `lain@${HOST}` };

/** The path decision 5 probes and Wired and Pleroma answer 404: the absent v2 document. */
const V2_PROBE = '/api/v2/instance';

/** The text that says a logged-out shell is ready for `/connect`. */
const NOT_CONNECTED = 'Not connected. Type /connect to log in.';

/**
 * Console errors and page exceptions, collected as ./boot.spec does, except the
 * one 404 the flow can produce: connect probes `/api/v2/instance` and Wired and
 * Pleroma have no v2 document (decision 5 treats the 404 as its absence), which
 * the browser logs as a failed resource load.
 */
export function watchErrors(page: Page): string[] {
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
export async function submit(page: Page, text: string): Promise<void> {
  const line = commandLine(page);
  await line.fill(text);
  await line.press('Enter');
}

/** {@link text} as a regular expression, whatever punctuation a title carries. */
function pattern(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** The status line's entry for the window titled {@link title}, whatever its number. */
export function windowEntry(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`Window \\d+: ${pattern(title)}`) });
}

/** The scrollback of the window whose log region is named {@link name}. */
export function logRegion(page: Page, name: string): Locator {
  return page.getByRole('log', { name });
}

/** An open modal box owns the keyboard and swallows every click beside it. */
async function closeBox(page: Page): Promise<void> {
  if (await page.getByRole('dialog').isVisible()) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
}

/** The window {@link title} becomes the one the reader is looking at. */
export async function showWindow(page: Page, title: string, log = title): Promise<void> {
  await closeBox(page);
  await windowEntry(page, title).click();
  await expect(logRegion(page, log)).toBeVisible();
}

/** Boots to a logged-out shell and runs `/connect` through the OAuth redirect. */
async function connect(page: Page): Promise<void> {
  await page.goto('/');
  await expect(logRegion(page, 'status')).toContainText(NOT_CONNECTED);
  await submit(page, '/connect');
}

/**
 * Logs in through the fixture flow of {@link instance} (the fake Wired one by
 * default) and waits for what startup opens: the status line's windows, the
 * login line in window 1 and the fixture posts in home — the reader ends up
 * looking at home, ready to move.
 */
export async function signIn(page: Page, instance: Instance = WIRED): Promise<void> {
  await instance.route(page);
  await connect(page);
  await expect(windowEntry(page, 'notifs')).toBeVisible();
  await showWindow(page, 'status');
  await expect(logRegion(page, 'status')).toContainText(
    `Logged in to ${ORIGIN} as @${instance.handle}`,
  );
  await showWindow(page, 'home');
  await expect(logRegion(page, 'home').locator('article').first()).toBeVisible();
}
