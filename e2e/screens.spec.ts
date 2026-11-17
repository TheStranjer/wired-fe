/**
 * Accessibility checks and review screenshots for every main screen (WFE-138):
 * the logged-in shell walked through window 1, home, notifications, a thread,
 * the composer, `/help` and navigation mode with the selection on a post, with
 * axe-core run over each screen and any `serious` or `critical` violation
 * failing the run, and a PNG of every one saved under test-results/screens/ for
 * a human to review. The screenshots are the review; there is no baseline image
 * to compare them with. The default theme gets the axe pass; `lain` and `bnet`
 * are shot again for their colors alone.
 *
 * One test per screen, not one test for the whole walk: seven axe passes over
 * seven screens do not fit inside a single Playwright timeout once the machine
 * is busy, and a screen's own test names the screen that failed. Each of them
 * walks the reader through the screens before its own, because the later
 * screens are states of the earlier ones.
 */

import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { logRegion, showWindow, signIn, submit, watchErrors } from './fixtures/session';

/** What one axe pass answers, read off the builder so axe-core stays transitive. */
type AxeResult = Awaited<ReturnType<AxeBuilder['analyze']>>;

/** The impacts that fail a screen; anything lighter is a note, not a gate. */
const BLOCKING: readonly string[] = ['serious', 'critical'];

/** The theme axe checks the shell in, and the name its PNGs are filed under. */
const DEFAULT_THEME = 'wired';

/** The themes that are only shot for review, `/theme` choosing each in turn. */
const EXTRA_THEMES: readonly string[] = ['lain', 'bnet'];

/** The window `/thread a0` opens, titled by the label it was given. */
const THREAD = 'thread/a0';

/** One screen: the name its PNG is reviewed under, and how the shell gets there. */
type Screen = {
  readonly name: string;
  readonly show: (page: Page) => Promise<void>;
};

/** Window 1, the client's own buffer: the banner, startup and the login line. */
async function statusScreen(page: Page): Promise<void> {
  await showWindow(page, 'status');
}

/** Window 2: the home timeline, carrying the fixture posts. */
async function homeScreen(page: Page): Promise<void> {
  await showWindow(page, 'home');
}

/** Window 3: the notifications, a mention as its post and the rest as `***` lines. */
async function notificationsScreen(page: Page): Promise<void> {
  await showWindow(page, 'notifs', 'notifications');
  await expect(logRegion(page, 'notifications').locator('article')).toHaveCount(1);
}

/** `/thread a0` from home: one post with its ancestors and replies around it. */
async function threadScreen(page: Page): Promise<void> {
  await showWindow(page, 'home');
  await submit(page, '/thread a0');
  await showWindow(page, THREAD);
  await expect(logRegion(page, THREAD).locator('article')).toHaveCount(4);
}

/** `/compose` with a draft in it: the modal box, its fields and its counter. */
async function composerScreen(page: Page): Promise<void> {
  await showWindow(page, 'home');
  await submit(page, '/compose present day, present time');
  await expect(page.getByRole('dialog', { name: 'Compose' })).toBeVisible();
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

/** The screens, in the order a reader would walk them. */
const SCREENS: readonly Screen[] = [
  { name: 'status', show: statusScreen },
  { name: 'home', show: homeScreen },
  { name: 'notifications', show: notificationsScreen },
  { name: 'thread', show: threadScreen },
  { name: 'composer', show: composerScreen },
  { name: 'help', show: helpScreen },
  { name: 'navigation', show: navigationScreen },
];

/** One violation as the lines a run prints: impact, rule, help, then every target. */
function describeViolation(violation: AxeResult['violations'][number]): string {
  const head = `${violation.impact ?? 'unknown'} ${violation.id} — ${violation.help}`;
  const nodes = violation.nodes.map((node) => `  ${node.target.join(' ')}: ${node.html}`);
  return [head, ...nodes].join('\n');
}

/** What one axe pass found: the violations that fail a screen, and the lighter ones. */
type Findings = {
  readonly blockers: string[];
  readonly notes: string[];
};

/** Sorts what {@link result} found on {@link screen} into failing and noteworthy. */
function findingsOf(result: AxeResult, screen: string): Findings {
  const found: Findings = { blockers: [], notes: [] };
  for (const violation of result.violations) {
    const line = `${screen}: ${describeViolation(violation)}`;
    const lighter = !BLOCKING.includes(violation.impact ?? '');
    (lighter ? found.notes : found.blockers).push(line);
  }
  return found;
}

/**
 * The screen as axe sees the whole page: a `serious` or `critical` violation
 * fails the run naming every node it found, and anything lighter is annotated
 * into the report rather than dropped — the gate stays exactly where the ticket
 * put it, and the review still sees what axe thought.
 */
async function checkAccessibility(page: Page, screen: string): Promise<void> {
  const found = findingsOf(await new AxeBuilder({ page }).analyze(), `axe-core on ${screen}`);
  for (const note of found.notes) {
    test.info().annotations.push({ type: 'axe-core', description: note });
  }
  if (found.blockers.length > 0) {
    const count = String(found.blockers.length);
    throw new Error(`${count} blocking violation(s)\n${found.blockers.join('\n')}`);
  }
}

/** The screen's review PNG, named for the theme it was shot in. */
async function shoot(page: Page, theme: string, screen: string): Promise<void> {
  await page.screenshot({ path: `test-results/screens/${theme}-${screen}.png` });
}

/**
 * Brings the shell to screen {@link index} by walking it through every screen
 * before that one, shooting nothing on the way: the review PNG for a screen
 * comes from the test that axe-checks it.
 */
async function walkTo(page: Page, index: number): Promise<void> {
  for (const screen of SCREENS.slice(0, index + 1)) {
    await screen.show(page);
  }
}

/** Every screen in {@link theme}, shot for review and left unchecked. */
async function shootAll(page: Page, theme: string): Promise<void> {
  for (const screen of SCREENS) {
    await screen.show(page);
    await shoot(page, theme, screen.name);
  }
}

for (const [index, screen] of SCREENS.entries()) {
  test(`the ${screen.name} screen passes axe, in the ${DEFAULT_THEME} theme`, async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await walkTo(page, index);
    await checkAccessibility(page, screen.name);
    await shoot(page, DEFAULT_THEME, screen.name);
    expect(errors).toStrictEqual([]);
  });
}

for (const theme of EXTRA_THEMES) {
  test(`every main screen is shot in the ${theme} theme`, async ({ page }) => {
    await signIn(page);
    await submit(page, `/theme ${theme}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await shootAll(page, theme);
  });
}
