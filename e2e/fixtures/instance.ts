/**
 * The wiring every fake instance shares (decisions 5 and 7): the OAuth login
 * routes, answered identically by Wired, Mastodon and Pleroma; the session
 * routes, which read whatever documents a backend module hands them; the Pleroma
 * dialect reaction route, served by ./wired and ./pleroma but not ./mastodon;
 * and the readers of status requests — the posted text of a create body, the id
 * (and context flag) a statuses URL names, the id and emoji a reactions URL
 * names. Which documents those routes answer with is each backend's own business.
 */

import type { Page, Request, Route } from '@playwright/test';

import { ORIGIN, json, type Json } from './wire';

/** The NodeInfo 2.1 relation Wired and Pleroma link from their discovery list. */
export const NODEINFO_REL_21 = 'http://nodeinfo.diaspora.software/ns/schema/2.1';

/** The NodeInfo 2.0 relation Mastodon and Pleroma serve next to the 2.1 one. */
export const NODEINFO_REL_20 = 'http://nodeinfo.diaspora.software/ns/schema/2.0';

/** A JSON object with {@link keys} taken out: the fields a backend does not send. */
export function without(doc: Json, ...keys: readonly string[]): Json {
  const dropped = new Set(keys);
  return Object.fromEntries(Object.entries(doc).filter(([key]) => !dropped.has(key)));
}

/** The documents one fake instance's session routes answer with. */
type InstanceContent = {
  /** `verify_credentials`: the account the session's token belongs to. */
  readonly self: Json;
  /** `GET /api/v1/timelines/home`, newest first as served. */
  readonly home: () => readonly Json[];
  /** `GET /api/v1/notifications`, newest first as served. */
  readonly notices: () => readonly Json[];
  /** `GET /api/v1/statuses/:id`: the status the id names, null for none. */
  readonly status: (id: string) => Json | null;
  /** `GET /api/v1/statuses/:id/context`: the conversation around that id. */
  readonly context: (id: string) => Json;
  /** `POST /api/v1/statuses`: the echo of post number {@link nth} of text. */
  readonly create: (text: string, nth: number) => Json;
};

/** The `status` text of a posted-status request body; '' when it has none. */
function postedText(request: Request): string {
  const body: unknown = request.postDataJSON();
  const sent: unknown =
    typeof body === 'object' && body !== null && 'status' in body ? body.status : '';
  return typeof sent === 'string' ? sent : '';
}

/** The URL's path segments, empty ones dropped, each one percent-decoded. */
function segments(url: string): readonly string[] {
  return new URL(url).pathname
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => decodeURIComponent(segment));
}

/** The session routes of {@link content}: the windows' reads and the post echo. */
function routeSession(page: Page, content: InstanceContent): readonly Promise<unknown>[] {
  let posts = 0;
  const statuses = async (route: Route): Promise<void> => {
    const request = route.request();
    if (request.method() === 'POST') {
      posts += 1;
      await json(route, content.create(postedText(request), posts));
      return;
    }
    const path = segments(request.url());
    const id = path.at(path.at(-1) === 'context' ? -2 : -1) ?? '';
    const found = content.status(id);
    if (path.at(-1) === 'context') {
      await json(route, content.context(id));
    } else if (found !== null) {
      await json(route, found);
    } else {
      await json(route, { error: 'Record not found.' }, 404);
    }
  };
  return [
    page.route('**/api/v1/accounts/verify_credentials', async (route) => {
      await json(route, content.self);
    }),
    page.route('**/api/v1/timelines/home*', async (route) => {
      await json(route, content.home());
    }),
    page.route('**/api/v1/notifications*', async (route) => {
      await json(route, content.notices());
    }),
    page.route('**/api/v1/custom_emojis', async (route) => {
      await json(route, []);
    }),
    page.route(/\/api\/v1\/statuses/, statuses),
    // The streaming socket (WFE-121): accepted and left silent, so the page's
    // live connection opens without an instance behind it.
    page.routeWebSocket(/\/api\/v1\/streaming/, () => undefined),
  ];
}

/**
 * The Pleroma-dialect reaction route (WBE-178): `PUT …/statuses/:id/reactions/:emoji`
 * answers the looked-up status carrying the emoji, `DELETE` answers it without.
 */
function routeReactions(
  page: Page,
  status: (id: string) => Json | null,
): readonly Promise<unknown>[] {
  return [
    page.route(/\/api\/v1\/pleroma\/statuses/, async (route) => {
      const path = segments(route.request().url());
      const found = status(path.at(-3) ?? '');
      if (found === null) {
        await json(route, { error: 'Record not found.' }, 404);
        return;
      }
      const attached = route.request().method() === 'PUT';
      const name = path.at(-1) ?? '';
      const emoji = attached ? [{ name, count: 1, me: true, url: null }] : [];
      const block = { conversation_id: 98765, emoji_reactions: emoji, local: true };
      await json(route, { ...found, pleroma: block });
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
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
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

/** One fake instance: its discovery routes, its documents, its reaction route. */
export type FakeInstance = {
  /** The routes describing the instance to the capability builder (decision 5). */
  readonly discovery: readonly Promise<unknown>[];
  /** The documents the session routes answer with. */
  readonly content: InstanceContent;
  /** Whether the backend serves the Pleroma-dialect reaction route (WBE-178). */
  readonly reactions: boolean;
};

/** Registers {@link fake}'s discovery, login, session and reaction routes. */
export async function routeInstance(page: Page, fake: FakeInstance): Promise<void> {
  const reactions = fake.reactions ? routeReactions(page, fake.content.status) : [];
  await Promise.all([
    ...fake.discovery,
    ...routeLogin(page),
    ...routeSession(page, fake.content),
    ...reactions,
  ]);
}
