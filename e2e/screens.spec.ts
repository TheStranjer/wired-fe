/**
 * Accessibility checks and review screenshots for every main screen (WFE-138,
 * WFE-251, decision 11): the stream feed with its cards, the same feed as IRC
 * lines, a composer pane beside it, a thread floating over it, the feed editor,
 * the open `◫▾` menu, the stream on a phone, and the status window, the
 * notifications, a thread, `/help` and navigation mode. Each one runs axe-core
 * with any `serious` or `critical` violation failing the run, and saves a PNG
 * under test-results/screens/ for a human to review, in each of the three
 * themes. The screenshots are the review; there is no baseline image to compare
 * them with.
 *
 * One test per screen and theme, not one for the whole walk: dozens of axe
 * passes do not fit inside a single Playwright timeout once the machine is
 * busy, and a test's own name says which screen failed in which theme. Every
 * screen starts from the sign-in alone (./fixtures/screens).
 */

import { expect, test, type Page } from '@playwright/test';

import { checkAccessibility, shoot } from './fixtures/review';
import { MOBILE_SCREEN, SCREENS, type Screen } from './fixtures/screens';
import { signIn, submit, watchErrors } from './fixtures/session';

/** The themes every screen is reviewed in; the first is the one a fresh shell starts in. */
const THEMES: readonly string[] = ['wired', 'lain', 'bnet'];

/** A phone: the 390 by 844 viewport and a mobile user agent that make the shell one pane at a time. */
const PHONE = {
  viewport: { width: 390, height: 844 },
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  isMobile: true,
  hasTouch: true,
};

/** Chooses {@link theme} with `/theme`, unless it is the one the shell starts in. */
async function chooseTheme(page: Page, theme: string): Promise<void> {
  if (theme !== THEMES[0]) {
    await submit(page, `/theme ${theme}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
}

/** Signs in, chooses {@link theme}, shows {@link screen}, checks it with axe and shoots it. */
async function review(page: Page, theme: string, screen: Screen): Promise<void> {
  const errors = watchErrors(page);
  await signIn(page);
  await chooseTheme(page, theme);
  await screen.show(page);
  await checkAccessibility(page, `${screen.name} (${theme})`);
  await shoot(page, theme, screen.name);
  expect(errors).toStrictEqual([]);
}

for (const theme of THEMES) {
  for (const screen of SCREENS) {
    test(`the ${screen.name} screen passes axe, in the ${theme} theme`, async ({ page }) => {
      await review(page, theme, screen);
    });
  }
}

test.describe('on a phone', () => {
  test.use(PHONE);

  for (const theme of THEMES) {
    test(`the ${MOBILE_SCREEN.name} screen passes axe, in the ${theme} theme`, async ({ page }) => {
      await review(page, theme, MOBILE_SCREEN);
    });
  }
});
