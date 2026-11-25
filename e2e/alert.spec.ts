/**
 * The modal alert an error line raises (WFE-271): in a feed pane, plain text is
 * refused ("You can't post in this window"), the refusal comes up as an
 * alertdialog over the shell, Enter dismisses it, the command line has the
 * keyboard again and the red line stays in the scrollback.
 */

import { expect, test } from '@playwright/test';

import { alertOf } from './fixtures/alert';
import { logRegion, showWindow, signIn, submit } from './fixtures/session';

/** The title of the stream feed's window: its name behind a tilde. */
const STREAM = '~stream';

/** What the feed pane says to plain text. */
const REFUSAL = "You can't post in this window. Try /home";

test('a refused post raises an alert that Enter dismisses, leaving the line behind', async ({
  page,
}) => {
  await signIn(page);
  await showWindow(page, STREAM, 'feed');

  await submit(page, 'hello feed');

  const alert = alertOf(page);
  await expect(alert).toBeVisible();
  await expect(alert).toHaveAccessibleDescription(REFUSAL);
  await expect(alert.getByRole('button', { name: 'OK' })).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Command line' })).toBeFocused();
  await expect(logRegion(page, 'feed')).toContainText(REFUSAL);
});
