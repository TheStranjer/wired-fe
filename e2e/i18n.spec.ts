/**
 * The i18n foundation (WFE-305): the page declares its language, and the
 * pilot message comes through `t()` — `/as` for an account the reader is not
 * signed in as says so, lists who is signed in and points to /connect. The
 * language is the reader's to choose (WFE-310): `/lang German` puts `de` on
 * the page and `/lang auto` goes back to the browser's language.
 */

import { expect, test } from '@playwright/test';

import { alertOf } from './fixtures/alert';
import { WIRED, logRegion, showWindow, signIn, submit } from './fixtures/session';

test('the page declares English', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('/as for an account nobody is signed in as prints the new refusal', async ({ page }) => {
  await signIn(page);
  await showWindow(page, '~stream', 'feed');
  const refusal = `You aren't signed in as @nobody@x.example. Signed in: @${WIRED.handle}. Type /connect to add an account.`;

  await submit(page, '/as @nobody@x.example hi');

  await expect(alertOf(page)).toHaveAccessibleDescription(refusal);
  await expect(logRegion(page, 'feed')).toContainText(refusal);
});

test('/lang German puts de on the page and /lang auto goes back to en', async ({ page }) => {
  await signIn(page);
  await showWindow(page, '~stream', 'feed');

  await submit(page, '/lang German');

  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(logRegion(page, 'feed')).toContainText('Sprache auf Deutsch (de) eingestellt');

  // The command line's own label is German now that the catalog has loaded.
  const line = page.getByRole('combobox', { name: 'Kommandozeile' });
  await line.fill('/lang auto');
  await line.press('Enter');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
