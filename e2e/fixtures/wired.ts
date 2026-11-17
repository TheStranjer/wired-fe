/**
 * The fake Wired instance the end-to-end specs run against (decisions 5 and 8):
 * the route handlers `page.route` needs for a same-origin build — NodeInfo, the
 * instance documents, OAuth, `verify_credentials`, the home timeline, the
 * notifications and custom emoji lists, one status and its context, and status
 * creation. ./content is what those routes answer with; this module is the
 * wiring, and {@link routeWired} the one entry point a spec calls.
 */

import type { Page, Request, Route } from '@playwright/test';

import {
  contextById,
  homeTimeline,
  notifications,
  postedStatusJson,
  statusById,
  SELF,
} from './content';
import { ORIGIN, json } from './wire';

/** The feature strings Wired advertises in NodeInfo and its v1 document. */
const FEATURES = ['pleroma_api', 'chat', 'pleroma_emoji_reactions', 'quote_posting'];

/** The `status` text of a posted-status request body; '' when it has none. */
function postedText(request: Request): string {
  const body: unknown = request.postDataJSON();
  const sent: unknown =
    typeof body === 'object' && body !== null && 'status' in body ? body.status : '';
  return typeof sent === 'string' ? sent : '';
}

/** How many statuses the session has posted, so every echo gets its own id. */
let posts = 0;

/** The id a statuses URL names, and whether it asks for that status's context. */
function statusTarget(url: string): { readonly id: string; readonly context: boolean } {
  const segments = new URL(url).pathname.split('/').filter((segment) => segment !== '');
  const context = segments.at(-1) === 'context';
  return { id: segments.at(context ? -2 : -1) ?? '', context };
}

/** `/api/v1/statuses`: a POST creates one status, a GET reads one or its context. */
async function statuses(route: Route): Promise<void> {
  const request = route.request();
  if (request.method() === 'POST') {
    posts += 1;
    await json(route, postedStatusJson(postedText(request), posts));
    return;
  }
  const target = statusTarget(request.url());
  if (target.context) {
    await json(route, contextById(target.id));
    return;
  }
  const found = statusById(target.id);
  await json(route, found ?? { error: 'Record not found.' }, found === null ? 404 : 200);
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

/** The session routes: who the token is, and what the windows read and write. */
function routeSession(page: Page): readonly Promise<unknown>[] {
  return [
    page.route('**/api/v1/accounts/verify_credentials', async (route) => {
      await json(route, SELF);
    }),
    page.route('**/api/v1/timelines/home*', async (route) => {
      await json(route, homeTimeline());
    }),
    page.route('**/api/v1/notifications*', async (route) => {
      await json(route, notifications());
    }),
    page.route('**/api/v1/custom_emojis', async (route) => {
      await json(route, []);
    }),
    page.route(/\/api\/v1\/statuses/, statuses),
  ];
}

/** Registers every fake route on {@link page}, awaited before the page is used. */
export async function routeWired(page: Page): Promise<void> {
  posts = 0;
  await Promise.all([...routeDiscovery(page), ...routeLogin(page), ...routeSession(page)]);
}
