/**
 * The modal alert an error line raises (WFE-271): in a feed pane, an unknown
 * command is refused ("Unknown command: /nope"), the refusal comes up as an
 * alertdialog over the shell, Enter dismisses it, the command line has the
 * keyboard again and the red line stays in the scrollback.
 */

import { expect, test } from '@playwright/test';

import { alertOf, backgroundAlpha } from './fixtures/alert';
import { logRegion, showWindow, signIn, submit } from './fixtures/session';

/** The title of the stream feed's window: its name behind a tilde. */
const STREAM = '~stream';

/** What the feed pane says to a command that does not exist. */
const REFUSAL = 'Unknown command: /nope. Try /help';

test('a refused command raises an alert that Enter dismisses, leaving the line behind', async ({
  page,
}) => {
  await signIn(page);
  await showWindow(page, STREAM, 'feed');

  await submit(page, '/nope');

  const alert = alertOf(page);
  await expect(alert).toBeVisible();
  await expect(alert).toHaveAccessibleDescription(REFUSAL);
  await expect(alert.getByRole('button', { name: 'OK' })).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Command line' })).toBeFocused();
  await expect(logRegion(page, 'feed')).toContainText(REFUSAL);
});

test('the backdrop dims the page with a translucent scrim while the box stays opaque', async ({
  page,
}) => {
  await signIn(page);
  await showWindow(page, STREAM, 'feed');

  await submit(page, '/nope');

  const alert = alertOf(page);
  await expect(alert).toBeVisible();

  const scrim = await backgroundAlpha(alert.locator('xpath=..'));
  expect(scrim).toBeGreaterThan(0);
  expect(scrim).toBeLessThan(1);
  expect(await backgroundAlpha(alert)).toBe(1);
});
