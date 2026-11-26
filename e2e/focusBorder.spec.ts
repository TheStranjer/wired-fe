/**
 * The focused thing glows (WFE-295, decision 16): a pane or float holding focus
 * has the bright `--color-border-focus` border and every other one the dim
 * `--color-border-idle`, and the two swap as focus moves.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { signIn, submit } from './fixtures/session';
import { floatOf, pane, press, titleBar } from './fixtures/tiling';

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

/** The computed border colour of {@link frame}. */
async function borderOf(frame: Locator): Promise<string> {
  return frame.evaluate((element) => getComputedStyle(element).borderTopColor);
}

/** Asserts that {@link bright} wears the focus token and {@link dim} the idle one. */
async function expectGlow(page: Page, bright: Locator, dim: Locator): Promise<void> {
  const focus = await tokenColor(page, '--color-border-focus');
  const idle = await tokenColor(page, '--color-border-idle');
  expect(focus).not.toBe(idle);
  expect(await borderOf(bright)).toBe(focus);
  expect(await borderOf(dim)).toBe(idle);
}

test('the focused pane glows, and /focus moves the glow', async ({ page }) => {
  await signIn(page);
  await press(page, 'Control+b', '%');
  const left = pane(page, 'home').nth(0);
  const right = pane(page, 'home').nth(1);
  await expect(right).toHaveAttribute('aria-current', 'true');
  await expectGlow(page, right, left);
  await submit(page, '/focus left');
  await expect(left).toHaveAttribute('aria-current', 'true');
  await expectGlow(page, left, right);
});

test('a float glows when focused and dims when a pane takes focus', async ({ page }) => {
  await signIn(page);
  await press(page, 'Control+b', '%');
  await submit(page, '/float');
  const float = floatOf(page, 'home');
  await expect(float).toHaveAttribute('aria-current', 'true');
  const tiled = pane(page, 'home').filter({ hasNot: page.getByRole('button', { name: /^Dock / }) });
  await expectGlow(page, float, tiled);
  await titleBar(tiled).click();
  await expect(tiled).toHaveAttribute('aria-current', 'true');
  await expectGlow(page, tiled, float);
});
