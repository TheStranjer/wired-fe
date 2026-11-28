/**
 * A profile permalink opened with no account (WFE-342, decisions 4 and 13):
 * wired-be sends browsers to `/users/<nickname>`, which startup rewrites to
 * `#/@<nickname>`; the visitor reads that local account's profile in a
 * read-only window under the instance's signed-out key, and `/follow` from it
 * is refused with the one sign-in message, with no write and no
 * `Authorization` header sent.
 */

import { expect, test, type Page } from '@playwright/test';

import { logRegion, submit, watchErrors } from './fixtures/session';
import { accountJson, json, ORIGIN } from './fixtures/wire';
import { routeWired } from './fixtures/wired';

const WANDA = accountJson({ id: 'AhZwandaAcc0000000000001', name: 'wanda', display: 'Wanda' });
const TITLE = '@wanda';
const REFUSAL = 'Sign in to do that: this window is read-only. Type /connect to log in.';

/**
 * Serves the bundle's nested asset URLs (`/users/wired.<hash>.js` and the
 * rest) from the root of `dist/`, as hosting rule 1 of the README does; the
 * preview server has no such rule and would answer them with `index.html`.
 */
async function routeNestedAssets(page: Page): Promise<void> {
  await page.route(/\/users\/wired\.[^/]+$/u, async (route) => {
    const file = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    await route.fulfill({ response: await route.fetch({ url: `${ORIGIN}/${file}` }) });
  });
}

/** The lookup of wanda by nickname, her account by id, and her posts. */
async function routeWanda(page: Page): Promise<void> {
  await page.route(/\/api\/v1\/accounts\/lookup\?/u, async (route) => {
    const acct = new URL(route.request().url()).searchParams.get('acct');
    await (acct === 'wanda' ? json(route, WANDA) : json(route, { error: 'Not found' }, 404));
  });
  await page.route(/\/api\/v1\/accounts\/AhZwandaAcc0000000000001(?:\?|$)/u, async (route) => {
    await json(route, WANDA);
  });
  await page.route(/\/api\/v1\/accounts\/AhZwandaAcc0000000000001\/statuses/u, async (route) => {
    await json(route, []);
  });
}

/** The API requests a visitor must never send: any write, and any carrying an `Authorization` header. */
function watchForbidden(page: Page): readonly string[] {
  const sent: string[] = [];
  page.on('request', (request) => {
    const signed = 'authorization' in request.headers();
    if (request.url().includes('/api/') && (request.method() !== 'GET' || signed)) {
      sent.push(`${request.method()} ${request.url()}`);
    }
  });
  return sent;
}

test('a visitor with no account reads a local profile from wired-be’s /users/<nickname>', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const sent = watchForbidden(page);
  await routeWired(page);
  await routeNestedAssets(page);
  await routeWanda(page);

  await page.goto('/users/wanda');

  await expect(logRegion(page, TITLE)).toBeVisible();
  await expect(page.getByText(/Wanda \(@wanda/u)).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');

  await submit(page, '/follow @wanda');

  await expect(logRegion(page, TITLE).getByText(REFUSAL)).toHaveCount(1);
  expect(sent).toStrictEqual([]);
  expect(errors).toStrictEqual([]);
});
