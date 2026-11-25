/**
 * The same session against all three fake backends (decision 5, WFE-139):
 * Wired (./fixtures/wired), Mastodon (./fixtures/mastodon) and Pleroma
 * (./fixtures/pleroma) each stand up one instance in its own document shapes,
 * and one parameterized flow runs against every one of them — sign in and read
 * home, where Mastodon's and Pleroma's boosts render as the dim `⟳ … boosted`
 * line and their quotes as the `┌ …` excerpt block; `/about`, reporting the
 * right backend, limits and feature flags; `/react a0 🔥`, refused as an
 * unsupported capability on Mastodon and sent to the Pleroma-dialect reactions
 * route on the backends that serve it; posting a line from home; and no
 * console errors anywhere along the way.
 */

import { expect, test, type Page } from '@playwright/test';

import { dismissAlert } from './fixtures/alert';
import { POSTED_TEXT } from './fixtures/content';
import {
  MASTODON,
  PLEROMA,
  WIRED,
  logRegion,
  showWindow,
  signIn,
  submit,
  watchErrors,
  type Instance,
} from './fixtures/session';
import { ORIGIN } from './fixtures/wire';

/** One backend's fixture plus what the same flow must show on it. */
type BackendCase = Instance & {
  readonly name: string;
  readonly posts: readonly string[];
  readonly boost: string | null;
  readonly quote: string | null;
  readonly about: readonly string[];
  readonly reacts: boolean;
};

/** The three fixtures, each advertising its own limits and features. */
const CASES: readonly BackendCase[] = [
  {
    name: 'wired',
    ...WIRED,
    posts: ['She is here.', 'the LAN is all one network'],
    boost: null,
    quote: null,
    reacts: true,
    about: [
      `The Wired at ${ORIGIN}`,
      'backend: wired',
      'posts: up to 5000 characters, 4 attachments',
      'polls: 4 options of 50 characters, 5m–30d',
      'features: emojiReactions, quotePosting, editing, localOnlyPosts, passwordResetApi, settingsStore, markdown',
      'device: desktop',
    ],
  },
  {
    name: 'mastodon',
    ...MASTODON,
    posts: ['the LAN is all one network', 'close the world. open your eyes.', 'Layer zero. Again.'],
    boost: '⟳ <alice> boosted',
    quote: '┌ [a3] <alice> She is here.',
    reacts: false,
    about: [
      `nxt at ${ORIGIN}`,
      'backend: mastodon',
      'posts: up to 500 characters, 4 attachments',
      'polls: 4 options of 50 characters, 5m–30d',
      'features: editing',
      'device: desktop',
    ],
  },
  {
    name: 'pleroma',
    ...PLEROMA,
    posts: ['the LAN is all one network', 'close the world. open your eyes.', 'Layer zero. Again.'],
    boost: '⟳ <alice> boosted',
    quote: '┌ [a3] <alice> She is here.',
    reacts: true,
    about: [
      `CYBERIA at ${ORIGIN}`,
      'backend: pleroma',
      'posts: up to 3000 characters, 4 attachments',
      'polls: 6 options of 40 characters, 1h–30d',
      'features: emojiReactions, customEmojiReactions, quotePosting, editing, localOnlyPosts, passwordResetApi, settingsStore, markdown',
      'device: desktop',
    ],
  },
];

/** Home, as the fixture serves it: every post, the boost line and the quote. */
async function readHome(page: Page, one: BackendCase): Promise<void> {
  const home = logRegion(page, 'home');
  await expect(home.locator('article')).toHaveCount(one.posts.length);
  for (const text of one.posts) {
    await expect(home.getByText(text)).toBeVisible();
  }
  if (one.boost !== null) {
    await expect(home).toContainText(one.boost);
  }
  if (one.quote !== null) {
    await expect(home).toContainText(one.quote);
  }
}

/** `/react a0 🔥`: sent to the reactions route where the backend serves it,
 * refused by capability where it does not. */
async function reactToFirst(page: Page, one: BackendCase, reactions: string[]): Promise<void> {
  const home = logRegion(page, 'home');
  await submit(page, '/react a0 🔥');
  if (!one.reacts) {
    await expect(home).toContainText("server (Mastodon) can't react to posts with emoji");
    await dismissAlert(page);
    expect(reactions).toStrictEqual([]);
    return;
  }
  await expect(home).toContainText('🔥 reacted to [a0]');
  expect(reactions).toStrictEqual(['PUT']);
}

/** `/about` in window 1: the six report lines the fixture's documents imply. */
async function reportAbout(page: Page, one: BackendCase): Promise<void> {
  await showWindow(page, 'status');
  await submit(page, '/about');
  const status = logRegion(page, 'status');
  for (const line of one.about) {
    await expect(status).toContainText(line);
  }
  await showWindow(page, 'home');
}

/** Posts {@link POSTED_TEXT} from home and sees it at the bottom. */
async function postALine(page: Page, one: BackendCase): Promise<void> {
  await submit(page, POSTED_TEXT);
  const home = logRegion(page, 'home');
  await expect(home.locator('article')).toHaveCount(one.posts.length + 1);
  await expect(home.locator('article').last()).toContainText(POSTED_TEXT);
}

for (const one of CASES) {
  test(`sign in, read home, /about, /react and post on ${one.name}`, async ({ page }) => {
    const errors = watchErrors(page);
    const reactions: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/reactions/')) {
        reactions.push(request.method());
      }
    });
    await signIn(page, one);
    await readHome(page, one);
    await reportAbout(page, one);
    await reactToFirst(page, one, reactions);
    await postALine(page, one);
    expect(errors).toStrictEqual([]);
  });
}
