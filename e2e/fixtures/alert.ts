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

/**
 * The alpha of an element's computed `background-color`: the fourth component
 * of an `rgba(...)` value, or 1 for an opaque `rgb(...)` one.
 */
export async function backgroundAlpha(element: Locator): Promise<number> {
  const color = await element.evaluate((el) => getComputedStyle(el).backgroundColor);
  const match = /^rgba?\(([^)]*)\)$/.exec(color);
  const parts = (match?.[1] ?? '').split(/[\s,/]+/).filter((part) => part !== '');
  expect(parts.length, `unexpected background-color "${color}"`).toBeGreaterThanOrEqual(3);
  return parts.length > 3 ? Number(parts[3]) : 1;
}

/** Presses OK on the alert that is open; the next queued alert, if any, shows after it. */
export async function dismissAlert(page: Page): Promise<void> {
  const alert = alertOf(page);
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'OK' }).click();
}
