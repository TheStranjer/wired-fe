/**
 * The main screens the review specs walk (decision 11, WFE-251): each one is
 * how the shell gets from a fresh sign-in to that screen, with the assertions
 * that say it is really there — the stream feed with its cards, the same feed
 * as IRC lines, a composer pane beside it, a thread floating over it, the feed
 * editor, the open `┃▾` menu, the stream on a phone — and the older screens that
 * remain: the status window, the notifications, a thread, `/help` and
 * navigation mode. Every screen starts from the sign-in alone, never from
 * another screen, so the specs can run them in any order and theme.
 */

import { expect, type Page } from '@playwright/test';

import { IMAGE_ALT } from './content';
import { logRegion, showWindow, submit } from './session';
import { pane } from './tiling';

/** One screen: the name its PNG is reviewed under, and how the shell gets there. */
export type Screen = {
  readonly name: string;
  readonly show: (page: Page) => Promise<void>;
};

/** The title of the stream feed's window: its name behind a tilde. */
const STREAM = '~stream';

/** Shows the stream feed, the window a first sign-in opens, with its cards drawn. */
async function showStream(page: Page): Promise<void> {
  await showWindow(page, STREAM, 'feed');
  await expect(pane(page, STREAM).getByRole('article').first()).toBeVisible();
}

/** The default stream: cards with avatars, a DM, notification cards and an image post. */
async function streamScreen(page: Page): Promise<void> {
  await showStream(page);
  const stream = pane(page, STREAM);
  await expect(stream.getByRole('article', { name: /^Direct message / })).toHaveCount(1);
  await expect(stream.getByRole('img', { name: IMAGE_ALT })).toBeVisible();
  await expect(stream.getByRole('img', { name: /^Avatar of / }).first()).toBeVisible();
}

/** The same stream as IRC lines: no avatars, the image behind a placeholder line. */
async function streamLinesScreen(page: Page): Promise<void> {
  await showStream(page);
  await submit(page, '/display density lines');
  const stream = pane(page, STREAM);
  await expect(stream.getByRole('img', { name: /^Avatar of / })).toHaveCount(0);
  await expect(stream.getByRole('img', { name: IMAGE_ALT })).toHaveCount(0);
}

/** `/vsplit composer`: the stream on the left, a composer pane on the right. */
async function splitScreen(page: Page): Promise<void> {
  await showStream(page);
  await submit(page, '/vsplit composer');
  await expect(pane(page, 'compose').getByRole('textbox', { name: 'Post text' })).toBeVisible();
  await expect(pane(page, STREAM)).toBeVisible();
}

/** The label the stream shows the post saying {@link text} under: `a3` of `Post a3 by …`. */
async function labelOf(page: Page, text: string): Promise<string> {
  const card = pane(page, STREAM)
    .getByRole('article', { name: /^Post \S+ by / })
    .filter({ hasText: text })
    .first();
  const name = (await card.getAttribute('aria-label')) ?? '';
  const label = /^Post (\S+) by /u.exec(name)?.[1];
  expect(label).toBeDefined();
  return label ?? '';
}

/** `/pop` on a post of the stream: its thread floating over the feed. */
async function floatScreen(page: Page): Promise<void> {
  await showStream(page);
  const label = await labelOf(page, 'She is here.');
  await submit(page, `/pop ${label}`);
  await expect(logRegion(page, `thread/${label}`).locator('article')).toHaveCount(4);
  await expect(pane(page, STREAM)).toBeVisible();
}

/** `/feed edit stream`: the feed editor in the stream's pane. */
async function feedEditorScreen(page: Page): Promise<void> {
  await showStream(page);
  await submit(page, '/feed edit stream');
  await expect(page.getByRole('textbox', { name: 'Feed name' })).toHaveValue('stream');
}

/** The `┃▾` button clicked: the menu of views a new pane can show, open. */
async function paneMenuScreen(page: Page): Promise<void> {
  await showStream(page);
  await page.getByRole('button', { name: 'Split side by side' }).click();
  await expect(page.getByRole('menu', { name: 'Split side by side' })).toBeVisible();
}

/** The stream on a phone: one full-size pane and the switcher in its title bar. */
async function mobileStream(page: Page): Promise<void> {
  await showStream(page);
  await expect(page.getByRole('button', { name: 'Switch pane' })).toBeVisible();
}

/** Window 1, the client's own buffer: the banner, startup and the login line. */
async function statusScreen(page: Page): Promise<void> {
  await showWindow(page, 'status');
}

/** Window 3: the notifications, a mention as its post and the rest as compact lines. */
async function notificationsScreen(page: Page): Promise<void> {
  await showWindow(page, 'notifs', 'notifications');
  await expect(logRegion(page, 'notifications').locator('article')).toHaveCount(1);
}

/** `/thread a0` from home: one post with its ancestors and replies around it. */
async function threadScreen(page: Page): Promise<void> {
  await showWindow(page, 'home');
  await submit(page, '/thread a0');
  await showWindow(page, 'thread/a0');
  await expect(logRegion(page, 'thread/a0').locator('article')).toHaveCount(4);
}

/** `/help` in window 1: the command list the one registry generates (decision 6). */
async function helpScreen(page: Page): Promise<void> {
  await showWindow(page, 'status');
  await submit(page, '/help');
  await expect(logRegion(page, 'status')).toContainText('Type /help <command> for details.');
}

/** Navigation mode with the selection on home's newest post: Escape, then j. */
async function navigationScreen(page: Page): Promise<void> {
  await showWindow(page, 'home');
  await page.keyboard.press('Escape');
  await page.keyboard.press('j');
  await expect(logRegion(page, 'home').locator('article[aria-current="true"]')).toHaveCount(1);
  await expect(page.getByText('[NAV]', { exact: true })).toBeVisible();
}

/** The one screen of a phone, which the mobile spec shows in a 390 by 844 viewport. */
export const MOBILE_SCREEN: Screen = { name: 'mobile', show: mobileStream };

/** The desktop screens, in the order a reader would walk them. */
export const SCREENS: readonly Screen[] = [
  { name: 'status', show: statusScreen },
  { name: 'stream', show: streamScreen },
  { name: 'stream-lines', show: streamLinesScreen },
  { name: 'split', show: splitScreen },
  { name: 'float', show: floatScreen },
  { name: 'feed-editor', show: feedEditorScreen },
  { name: 'pane-menu', show: paneMenuScreen },
  { name: 'notifications', show: notificationsScreen },
  { name: 'thread', show: threadScreen },
  { name: 'help', show: helpScreen },
  { name: 'navigation', show: navigationScreen },
];
