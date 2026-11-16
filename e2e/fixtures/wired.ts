/**
 * The fake Wired instance for the end-to-end login flow (decisions 5 and 8):
 * the route handlers `page.route` needs for the same-origin build — NodeInfo,
 * instance documents, OAuth, `verify_credentials`, the home timeline, the
 * notifications list, status creation. Bodies follow Wired's shapes, the ones
 * src/api's fixtures show.
 */

import type { Page, Request, Route } from '@playwright/test';

/** The preview server's origin: the instance a same-origin build connects to. */
export const ORIGIN = 'http://127.0.0.1:4173';

/** The handle `verify_credentials` proves, as Wired' fqn reports it. */
export const HANDLE = `lain@${new URL(ORIGIN).host}`;

/** The plain text the spec posts, so typing and asserting share one string. */
export const POSTED_TEXT = 'present day, present time';

/** The feature strings Wired advertises in NodeInfo and its v1 document. */
const FEATURES = ['pleroma_api', 'chat', 'pleroma_emoji_reactions', 'quote_posting'];

/** Wired' HTML-escapes the post's text; these three entities cover the test. */
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/** A Wired-shaped local account, the form verify_credentials and rows carry. */
function accountJson(id: string, name: string, displayName: string): Record<string, unknown> {
  return {
    id,
    username: name,
    acct: name,
    fqn: `${name}@${new URL(ORIGIN).host}`,
    display_name: displayName,
    created_at: '1998-07-06T00:00:00.000Z',
    note: `<p>${name}</p>`,
    url: `${ORIGIN}/users/${name}`,
    avatar: `${ORIGIN}/images/avi.png`,
    header: `${ORIGIN}/images/banner.png`,
    followers_count: 1,
    following_count: 1,
    statuses_count: 9,
  };
}

const LAIN = accountJson('AhZlainAcc00000000000001', 'lain', 'Lain Iwakura');
const ALICE = accountJson('AhZalic3Acc00000000000001', 'alice', 'Alice');

/** One Wired-shaped status: `content` is the HTML body the backend renders. */
function statusJson(fields: {
  readonly id: string;
  readonly account: 'lain' | 'alice';
  readonly content: string;
  readonly created: string;
}): unknown {
  const { id, content, created } = fields;
  return {
    id,
    uri: `${ORIGIN}/posts/${id}`,
    created_at: created,
    account: fields.account === 'lain' ? LAIN : ALICE,
    content,
    visibility: 'public',
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 0,
    pleroma: { local: true, conversation_id: `AhZconv${id}` },
  };
}

/** The two posts the home timeline answers, newest first as Wired serves them. */
function homeTimeline(): unknown[] {
  return [
    statusJson({
      id: 'AhZst4tus00000000000000002',
      account: 'alice',
      content: '<p>the LAN is all one network</p>',
      created: '2026-11-15T09:00:00.000Z',
    }),
    statusJson({
      id: 'AhZst4tus00000000000000001',
      account: 'alice',
      content: '<p>She is here.</p>',
      created: '2026-11-15T08:58:00.000Z',
    }),
  ];
}

/** Serves `body` as JSON with `status`; the strings src/api reads survive it all. */
async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** The `status` text of a posted-status request body; '' when it has none. */
function postedText(request: Request): string {
  const body: unknown = request.postDataJSON();
  if (typeof body !== 'object' || body === null || !('status' in body)) {
    return '';
  }
  const text: unknown = body.status;
  return typeof text === 'string' ? text : '';
}

let posts = 0;

/** POST /api/v1/statuses: answers the posted text back as a new status of lain. */
async function postedStatus(route: Route): Promise<void> {
  posts += 1;
  const text = postedText(route.request()).replace(/[&<>]/gu, (c) => ENTITIES[c] ?? c);
  await json(
    route,
    statusJson({
      id: String(900000000000000000 + posts),
      account: 'lain',
      content: `<p>${text}</p>`,
      created: new Date().toISOString(),
    }),
  );
}

/** The routes that describe the instance to the capability builder (decision 5). */
function routeDiscovery(page: Page): readonly Promise<unknown>[] {
  return [
    page.route('**/.well-known/nodeinfo', async (route) => {
      const origin = new URL(route.request().url()).origin;
      const rel = 'http://nodeinfo.diaspora.software/ns/schema/2.1';
      await json(route, { links: [{ rel, href: `${origin}/nodeinfo/2.1` }] });
    }),
    page.route('**/nodeinfo/2.1', async (route) => {
      await json(route, {
        version: '2.1',
        software: { name: 'wired', version: '0.1.0' },
        metadata: { nodeName: 'The Wired', features: FEATURES },
      });
    }),
    page.route('**/api/v1/instance', async (route) => {
      await json(route, {
        uri: new URL(ORIGIN).host,
        title: 'The Wired',
        version: '2.7.2 (compatible; Wired 0.1.0)',
        max_toot_chars: 5000,
        pleroma: { metadata: { features: FEATURES } },
      });
    }),
    page.route('**/api/v2/instance', async (route) => {
      await json(route, { error: 'Record not found.' }, 404);
    }),
  ];
}

/** The login routes (decision 8): authorize answers the 302 back with the code. */
function routeLogin(page: Page): readonly Promise<unknown>[] {
  return [
    page.route('**/oauth/authorize*', async (route) => {
      const state = new URL(route.request().url()).searchParams.get('state') ?? '';
      const target = new URL(`${ORIGIN}/`);
      target.searchParams.set('code', 'test-code');
      target.searchParams.set('state', state);
      await route.fulfill({ status: 302, body: '', headers: { location: target.toString() } });
    }),
    page.route('**/api/v1/apps', async (route) => {
      await json(route, {
        name: 'WIRED',
        client_id: 'wiredfe-test-client-id',
        client_secret: 'wiredfe-test-client-secret',
      });
    }),
    page.route('**/oauth/token', async (route) => {
      await json(route, {
        access_token: 'wiredfe-test-token',
        token_type: 'Bearer',
        scope: 'read write follow push',
      });
    }),
  ];
}

/** The session routes: who the token is, the home page, empty notifications, the status echo. */
function routeSession(page: Page): readonly Promise<unknown>[] {
  return [
    page.route('**/api/v1/accounts/verify_credentials', async (route) => {
      await json(route, LAIN);
    }),
    page.route('**/api/v1/timelines/home*', async (route) => {
      await json(route, homeTimeline());
    }),
    page.route('**/api/v1/notifications*', async (route) => {
      await json(route, []);
    }),
    page.route('**/api/v1/statuses*', async (route) => {
      await postedStatus(route);
    }),
  ];
}

/** Registers every fake route on {@link page}, awaited before the page is used. */
export async function routeWired(page: Page): Promise<void> {
  posts = 0;
  await Promise.all([...routeDiscovery(page), ...routeLogin(page), ...routeSession(page)]);
}
