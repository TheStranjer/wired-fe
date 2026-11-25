/**
 * What reviewing a screen takes (decision 11): the axe-core pass over the page
 * as it stands, which fails the run on a `serious` or `critical` violation and
 * annotates the lighter ones into the report, and the review PNG filed under
 * the theme and the screen it shows. The screens themselves are ./screens'.
 */

import { AxeBuilder } from '@axe-core/playwright';
import { test, type Page } from '@playwright/test';

/** What one axe pass answers, read off the builder so axe-core stays transitive. */
type AxeResult = Awaited<ReturnType<AxeBuilder['analyze']>>;

/** The impacts that fail a screen; anything lighter is a note, not a gate. */
const BLOCKING: readonly string[] = ['serious', 'critical'];

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
export async function checkAccessibility(page: Page, screen: string): Promise<void> {
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
export async function shoot(page: Page, theme: string, screen: string): Promise<void> {
  await page.screenshot({ path: `test-results/screens/${theme}-${screen}.png` });
}
