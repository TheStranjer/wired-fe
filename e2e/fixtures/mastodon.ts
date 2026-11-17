/**
 * The fake Mastodon instance the backend specs run against (decisions 5 and 7):
 * the route set ./instance lays out — NodeInfo discovery, the v1 *and* v2
 * instance documents, OAuth, `verify_credentials`, the home timeline, the
 * notifications and custom emoji lists, one status and its context, and status
 * creation — answered with Mastodon's own shapes: no `fqn` and no `pleroma`
 * block, a boost as a status wrapping its `reblog`, a quote as the 4.5
 * `{state, quoted_status}` wrapper, and no reaction route at all (the app
 * refuses `/react` before sending it). {@link routeMastodon} is the entry point.
 */

import type { Page } from '@playwright/test';

import { NODEINFO_REL_20, routeInstance, without } from './instance';
import {
  HOST,
  ORIGIN,
  accountJson,
  escapeHtml,
  json,
  statusJson,
  type Json,
  type Person,
  type Post,
} from './wire';

/** The instance's two locals; Mastodon reports both without a domain or fqn. */
const LAIN: Person = { id: '109320', name: 'lain', display: 'Lain Iwakura' };
const ALICE: Person = { id: '109321', name: 'alice', display: 'Alice' };

/** The fixture day at {@link clock}. */
function moment(clock: string): string {
  return `2026-11-15T${clock}:00.000Z`;
}

/** The account document, as Mastodon's serializer renders a local. */
function mastoAccount(person: Person): Json {
  return { ...without(accountJson(person), 'fqn'), url: `${ORIGIN}/@${person.name}` };
}

/** One status as Mastodon renders it: no `pleroma`, its own URIs, plus {@link extra}. */
function mastoStatus(post: Post, extra: Json): Json {
  const nick = post.who.name;
  return {
    ...without(statusJson(post), 'pleroma'),
    account: mastoAccount(post.who),
    uri: `${ORIGIN}/users/${nick}/statuses/${post.id}`,
    url: `${ORIGIN}/@${nick}/${post.id}`,
    reblog: null,
    ...extra,
  };
}

/** The body texts, shared by the boosted original and its announce wrapper. */
const EYES_HTML = '<p>close the world. open your eyes.</p>';
const HERE_HTML = '<p>She is here.</p>';
const LAN_HTML = '<p>the LAN is all one network</p>';

/** HERE is quoted from off-timeline; EYES is boosted; the rest is home. */
const HERE = mastoStatus({ id: '115001', who: ALICE, html: HERE_HTML, at: moment('08:58') }, {});
const EYES = mastoStatus({ id: '115002', who: LAIN, html: EYES_HTML, at: moment('08:55') }, {});
const LAN = mastoStatus({ id: '115003', who: ALICE, html: LAN_HTML, at: moment('09:00') }, {});
const BOOST = mastoStatus(
  { id: '115004', who: ALICE, html: EYES_HTML, at: moment('09:05') },
  { reblog: EYES },
);
const QUOTE = mastoStatus(
  { id: '115005', who: LAIN, html: '<p>Layer zero. Again.</p>', at: moment('09:10') },
  {
    quote: { state: 'accepted', quoted_status_id: '115001', quoted_status: HERE },
  },
);

/** The statuses GET /api/v1/statuses/:id can name, by id. */
const BY_ID: ReadonlyMap<string, Json> = new Map(
  [HERE, EYES, LAN, BOOST, QUOTE].map((one) => [String(one['id']), one]),
);

/** One notification as Mastodon reports it, from alice; `follow` has no status. */
function notice(id: string, type: string, st?: Json): Json {
  return {
    id,
    type,
    created_at: moment('09:05'),
    account: mastoAccount(ALICE),
    status: st ?? null,
  };
}

/** Mastodon's stock limits, the same block in its v1 and v2 documents. */
const CONFIGURATION: Json = {
  statuses: { max_characters: 500, max_media_attachments: 4 },
  polls: {
    max_options: 4,
    max_characters_per_option: 50,
    min_expiration: 300,
    max_expiration: 2629746,
  },
};

/** The routes that describe the instance to the capability builder (decision 5). */
function routeDiscovery(page: Page): readonly Promise<unknown>[] {
  return [
    page.route('**/.well-known/nodeinfo', async (route) => {
      const origin = new URL(route.request().url()).origin;
      await json(route, { links: [{ rel: NODEINFO_REL_20, href: `${origin}/nodeinfo/2.0` }] });
    }),
    page.route('**/nodeinfo/2.0', async (route) => {
      await json(route, {
        version: '2.0',
        software: { name: 'mastodon', version: '4.5.0' },
        protocols: ['activitypub'],
        services: { inbound: [], outbound: [] },
        openRegistrations: false,
        usage: { users: { total: 2, activeMonth: 2, activeHalfyear: 2 }, localPosts: 5 },
        metadata: { nodeName: 'nxt', nodeDescription: 'a new world.' },
      });
    }),
    page.route('**/api/v1/instance', async (route) => {
      await json(route, {
        uri: HOST,
        title: 'nxt',
        short_description: 'a new world.',
        version: '4.5.0',
        urls: { streaming_api: `ws://${HOST}` },
        stats: { user_count: 2, status_count: 5, domain_count: 1 },
        languages: ['en'],
        registrations: false,
        approval_required: false,
        configuration: CONFIGURATION,
        rules: [],
      });
    }),
    page.route('**/api/v2/instance', async (route) => {
      await json(route, {
        domain: HOST,
        title: 'nxt',
        version: '4.5.0',
        description: 'a new world.',
        languages: ['en'],
        configuration: CONFIGURATION,
        api_versions: { mastodon: 2, twemoji: 'v15.1.0' },
        registrations: { enabled: false, approval_required: false, message: null },
        rules: [],
      });
    }),
  ];
}

/** Registers every fake route on {@link page}, awaited before the page is used. */
export async function routeMastodon(page: Page): Promise<void> {
  await routeInstance(page, {
    discovery: routeDiscovery(page),
    content: {
      self: mastoAccount(LAIN),
      home: () => [QUOTE, BOOST, LAN],
      notices: () => [
        notice('2003', 'reblog', EYES),
        notice('2002', 'favourite', LAN),
        notice('2001', 'follow'),
      ],
      status: (id: string) => BY_ID.get(id) ?? null,
      context: () => ({ ancestors: [], descendants: [] }),
      create: (text: string, nth: number) =>
        mastoStatus(
          {
            id: String(115005 + nth),
            who: LAIN,
            html: `<p>${escapeHtml(text)}</p>`,
            at: new Date().toISOString(),
          },
          {},
        ),
    },
    reactions: false,
  });
}
