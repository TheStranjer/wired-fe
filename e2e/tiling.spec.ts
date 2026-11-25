/**
 * The tiling desktop by keyboard and command line (WFE-250, decisions 12 to 18):
 * the tmux-style `Ctrl+B` keys, the vim-style `w` keys of navigation mode, the
 * desktop hotkeys, the layout commands, and the focus a split screen shows.
 * The mouse flows (pane buttons, floats, dividers) are in ./tiling.mouse.spec.
 * Everything is found by role and accessible name, never by class.
 */

import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { logRegion, signIn, submit } from './fixtures/session';
import { desktopButton, floatOf, pane, press, routeTags, titleBar } from './fixtures/tiling';

/** Whether the pane showing {@link title} is the focused one. */
async function expectFocused(page: Page, title: string, index = 0): Promise<void> {
  await expect(pane(page, title).nth(index)).toHaveAttribute('aria-current', 'true');
}

test('Ctrl+B splits, focuses and closes panes, and the closed window stays open', async ({
  page,
}) => {
  await signIn(page);
  await press(page, 'Control+b', '%');
  await expect(pane(page, 'home')).toHaveCount(2);
  await expectFocused(page, 'home', 1);
  await submit(page, '/win 1');
  await expect(pane(page, 'status')).toBeVisible();
  await press(page, 'Control+b', 'ArrowLeft');
  await expectFocused(page, 'home');
  await expect(titleBar(pane(page, 'home'))).toContainText('[*]');
  await expect(titleBar(pane(page, 'status'))).not.toContainText('[*]');
  await press(page, 'Control+b', 'x');
  await expect(pane(page, 'home')).toHaveCount(0);
  await submit(page, '/clear');
  await submit(page, '/win list');
  await expect(logRegion(page, 'status')).toContainText(/\d+: home/u);
});

test('the vim keys of navigation mode split, move between panes and keep one', async ({ page }) => {
  await signIn(page);
  await press(page, 'Escape', 'w', 's');
  await expect(page.getByText('[NAV]', { exact: true })).toBeVisible();
  await expect(pane(page, 'home')).toHaveCount(2);
  await expect(page.getByRole('separator', { name: 'Resize panes' })).toHaveAttribute(
    'aria-orientation',
    'horizontal',
  );
  await expectFocused(page, 'home', 1);
  await press(page, 'w', 'k');
  await expectFocused(page, 'home', 0);
  await press(page, 'w', 'j');
  await expectFocused(page, 'home', 1);
  await press(page, 'w', 'o');
  await expect(pane(page, 'home')).toHaveCount(1);
});

test('Alt+digit jumps to a desktop and Alt+[ steps back, wrapping from the first', async ({
  page,
}) => {
  await signIn(page);
  await press(page, 'Alt+2');
  await expect(page.getByText(/^empty desktop/u)).toBeVisible();
  await expect(desktopButton(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(desktopButton(page, 2)).toHaveText('[2*]');
  await expect(desktopButton(page, 1)).toHaveText(/^\[1(?::\d+)?\]$/u);
  await press(page, 'Alt+[');
  await expect(desktopButton(page, 1)).toHaveAttribute('aria-current', 'true');
  await expect(desktopButton(page, 1)).toHaveText(/^\[1\*(?::\d+)?\]$/u);
  await expect(pane(page, 'home')).toBeVisible();
});

test('Alt+[ from the first desktop lands on the last one', async ({ page }) => {
  await signIn(page);
  await press(page, 'Alt+2', 'Alt+1');
  await expect(desktopButton(page, 1)).toHaveAttribute('aria-current', 'true');
  await press(page, 'Alt+[');
  await expect(desktopButton(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(desktopButton(page, 2)).toHaveText('[2*]');
  await expect(desktopButton(page, 1)).not.toHaveAttribute('aria-current', 'true');
});

test('/vsplit, /float, /dock, /desktop and /mvd lay the desktop out', async ({ page }) => {
  await routeTags(page);
  await signIn(page);
  await submit(page, '/vsplit tag rust');
  await expect(pane(page, 'home')).toBeVisible();
  await expectFocused(page, '#rust');
  await submit(page, '/float');
  await expect(floatOf(page, '#rust')).toBeVisible();
  await submit(page, '/dock');
  await expect(floatOf(page, '#rust')).toHaveCount(0);
  await expect(pane(page, '#rust')).toBeVisible();
  await expectFocused(page, '#rust');
});

test('/mvd moves a pane to another desktop, and follow goes with it', async ({ page }) => {
  await routeTags(page);
  await signIn(page);
  await submit(page, '/vsplit tag rust');
  await expectFocused(page, '#rust');
  await submit(page, '/mvd 3');
  await expect(pane(page, '#rust')).toHaveCount(0);
  await submit(page, '/desktop 3');
  await expect(desktopButton(page, 3)).toHaveAttribute('aria-current', 'true');
  await expect(pane(page, '#rust')).toBeVisible();
  await submit(page, '/mvd 1 follow');
  await expect(desktopButton(page, 1)).toHaveAttribute('aria-current', 'true');
  await expect(pane(page, '#rust')).toBeVisible();
  await expect(pane(page, 'home')).toBeVisible();
});

test('the split screen has no focus violations and one focused pane', async ({ page }) => {
  await signIn(page);
  await submit(page, '/vsplit');
  await expect(pane(page, 'home')).toHaveCount(2);
  await expect(titleBar(pane(page, 'home').nth(1))).toContainText('[*]');
  await expect(titleBar(pane(page, 'home').first())).not.toContainText('[*]');
  const result = await new AxeBuilder({ page }).analyze();
  const focus = result.violations.filter((violation) => violation.id.includes('focus'));
  expect(focus.map((violation) => violation.id)).toStrictEqual([]);
});
