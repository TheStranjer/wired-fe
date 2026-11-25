/**
 * The fake Pleroma instance the backend specs run against (decisions 5 and 7):
 * the route set ./instance lays out — NodeInfo discovery, the v1 instance
 * document (Pleroma 404s the v2 probe), OAuth, `verify_credentials`, the home
 * timeline, the notifications and custom emoji lists, one status and its
 * context, status creation, and the reaction route
 * `PUT/DELETE /api/v1/pleroma/statuses/:id/reactions/:emoji` it invented —
 * answered with Pleroma's own shapes: the account carries an `fqn`, a boost is
 * a status wrapping its `reblog`, and a quote rides in the status' `pleroma`
 * block. {@link routePleroma} is the entry point.
 */

import type { Page } from '@playwright/test';

import { NODEINFO_REL_20, NODEINFO_REL_21, routeInstance } from './instance';
import {
  HOST,
  ORIGIN,
  accountJson,
  escapeHtml,
  json,
  notificationJson,
  statusJson,
  type Json,
  type Notice,
  type Person,
  type Post,
} from './wire';

/** The instance's two locals: Pleroma gives both an fqn. */
const LAIN: Person = { id: '9vBunnyAcc00000000000001', name: 'lain', display: 'Lain Iwakura' };
const ALICE: Person = { id: '9vBunnyAcc00000000000002', name: 'alice', display: 'Alice' };

/** The feature strings Pleroma advertises in NodeInfo and its v1 document. */
const FEATURES = [
  'pleroma_api',
  'mastodon_api',
  'editing',
  'quote_posting',
  'pleroma_emoji_reactions',
  'pleroma_custom_emoji_reactions',
];

/** The post formats Pleroma lists in its v1 document; Markdown among them turns `markdown` on. */
const POST_FORMATS = ['text/plain', 'text/html', 'text/markdown'];

/** The fixture day at {@link clock}. */
function moment(clock: string): string {
  return `2026-11-15T${clock}:00.000Z`;
}

/** One status as Pleroma renders it: ./wire's document, its URL and block. */
function pleromaStatus(post: Post, extra: Json = {}, quote: Json | null = null): Json {
  return {
    ...statusJson(post),
    url: `${ORIGIN}/notice/${post.id}`,
    ...extra,
    pleroma: { local: true, conversation_id: 98765, emoji_reactions: [], quote },
  };
}

/** HERE is quoted from off-timeline; EYES is boosted; the rest is home. */
const EYES_HTML = '<p>close the world. open your eyes.</p>';
const HERE = pleromaStatus({
  id: '9tH3r3St4tus00000001',
  who: ALICE,
  html: '<p>She is here.</p>',
  at: moment('08:58'),
});
const EYES = pleromaStatus({
  id: '9t3y3St4tus000000001',
  who: LAIN,
  html: EYES_HTML,
  at: moment('08:55'),
});
const LAN = pleromaStatus({
  id: '9tL4nSt4tus0000000001',
  who: ALICE,
  html: '<p>the LAN is all one network</p>',
  at: moment('09:00'),
});
const QUOTE = pleromaStatus(
  {
    id: '9tQu0t3St4tus00000001',
    who: LAIN,
    html: '<p>Layer zero. Again.</p>',
    at: moment('09:10'),
  },
  {},
  HERE,
);
const BOOST = pleromaStatus(
  { id: '9tB00st4ct1v1ty000001', who: ALICE, html: EYES_HTML, at: moment('09:05') },
  { reblog: EYES },
);

/** The statuses GET /api/v1/statuses/:id can name, by id. */
const BY_ID: ReadonlyMap<string, Json> = new Map(
  [HERE, EYES, LAN, BOOST, QUOTE].map((one) => [String(one['id']), one]),
);

/** The notices waiting in the notifications window, newest first as served. */
const NOTICES: readonly Notice[] = [
  {
    id: '0004',
    type: 'pleroma:emoji_reaction',
    who: LAIN,
    at: moment('09:06'),
    status: LAN,
    emoji: '🔥',
  },
  { id: '0003', type: 'reblog', who: ALICE, at: moment('09:05'), status: EYES },
  { id: '0002', type: 'favourite', who: ALICE, at: moment('09:02'), status: LAN },
  { id: '0001', type: 'follow', who: ALICE, at: moment('09:01') },
];

/** The routes that describe the instance to the capability builder (decision 5). */
function routeDiscovery(page: Page): readonly Promise<unknown>[] {
  return [
    page.route('**/.well-known/nodeinfo', async (route) => {
      const origin = new URL(route.request().url()).origin;
      await json(route, {
        links: [
          { rel: NODEINFO_REL_20, href: `${origin}/nodeinfo/2.0` },
          { rel: NODEINFO_REL_21, href: `${origin}/nodeinfo/2.1` },
        ],
      });
    }),
    page.route('**/nodeinfo/2.1', async (route) => {
      await json(route, {
        version: '2.1',
        software: { name: 'pleroma', version: '2.7.2' },
        protocols: ['activitypub'],
        services: { inbound: [], outbound: [] },
        openRegistrations: false,
        usage: { users: { total: 2, activeMonth: 2, activeHalfyear: 2 }, localPosts: 5 },
        metadata: { nodeName: 'CYBERIA', features: FEATURES },
      });
    }),
    page.route('**/api/v1/instance', async (route) => {
      await json(route, {
        uri: HOST,
        title: 'CYBERIA',
        version: '2.7.2 (compatible; Pleroma 2.7.2)',
        urls: { streaming_api: `ws://${HOST}` },
        stats: { user_count: 2, status_count: 5, domain_count: 1 },
        languages: ['en'],
        registrations: false,
        max_toot_chars: 3000,
        poll_limits: {
          max_options: 6,
          max_option_chars: 40,
          min_expiration: 3600,
          max_expiration: 2592000,
        },
        pleroma: { metadata: { features: FEATURES, post_formats: POST_FORMATS } },
      });
    }),
    page.route('**/api/v2/instance', async (route) => {
      await json(route, { error: 'Record not found.' }, 404);
    }),
  ];
}

/** Registers every fake route on {@link page}, awaited before the page is used. */
export async function routePleroma(page: Page): Promise<void> {
  await routeInstance(page, {
    discovery: routeDiscovery(page),
    content: {
      self: accountJson(LAIN),
      home: () => [QUOTE, BOOST, LAN],
      notices: () => NOTICES.map(notificationJson),
      status: (id: string) => BY_ID.get(id) ?? null,
      context: () => ({ ancestors: [], descendants: [] }),
      create: (text: string, nth: number) =>
        pleromaStatus({
          id: `9tP0st${String(nth).padStart(16, '0')}`,
          who: LAIN,
          html: `<p>${escapeHtml(text)}</p>`,
          at: new Date().toISOString(),
        }),
    },
    reactions: true,
  });
}
