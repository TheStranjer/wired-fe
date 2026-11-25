/**
 * The modal alert every error line raises (WFE-271), as the specs meet it: an
 * `alertdialog` named Error whose only button is OK. It covers the page, so a
 * spec that provokes an error line dismisses the alert before it types or
 * clicks on.
 */

import { expect, type Locator, type Page } from '@playwright/test';

/** The error alert, when one is open. */
export function alertOf(page: Page): Locator {
  return page.getByRole('alertdialog', { name: 'Error' });
}

/** Presses OK on the alert that is open; the next queued alert, if any, shows after it. */
export async function dismissAlert(page: Page): Promise<void> {
  const alert = alertOf(page);
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'OK' }).click();
}
