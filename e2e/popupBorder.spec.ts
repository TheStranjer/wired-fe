/**
 * The suggestion list has a visible border (WFE-303): typing `/` opens it with
 * a solid border in the neutral `--color-border-popup` grey, not the focus
 * accent or the error red.
 */

import { expect, test, type Page } from '@playwright/test';

import { signIn } from './fixtures/session';

/** The computed colour of the custom property {@link token}, as the browser resolves a `color`. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);
}

test('typing / opens a suggestion list with a solid grey border', async ({ page }) => {
  await signIn(page);

  await page.getByRole('combobox', { name: 'Command line' }).fill('/');

  const popup = page.getByRole('listbox').locator('xpath=..');
  await expect(popup).toBeVisible();

  const border = await popup.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.borderTopStyle, color: style.borderTopColor };
  });
  expect(border.style).toBe('solid');
  expect(border.color).toBe(await tokenColor(page, '--color-border-popup'));
  expect(border.color).not.toBe(await tokenColor(page, '--color-border-focus'));
  expect(border.color).not.toBe(await tokenColor(page, '--color-border-idle'));
  expect(border.color).not.toBe(await tokenColor(page, '--color-error'));
});
