/**
 * The fake Wired instance the end-to-end specs run against (decisions 5 and 8):
 * the discovery documents that say "Wired", and the route set ./instance lays
 * out — NodeInfo, the instance documents, OAuth, `verify_credentials`, the home
 * timeline, the notifications and custom emoji lists, one status and its
 * context, status creation, and the Pleroma-dialect reaction route Wired serves
 * because it speaks that dialect. ./content is what those routes answer with,
 * and {@link routeWired} the one entry point a spec calls.
 */

import type { Page } from '@playwright/test';

import {
  contextById,
  homeTimeline,
  notifications,
  postedStatusJson,
  statusById,
  SELF,
} from './content';
import { NODEINFO_REL_21, routeInstance } from './instance';
import { ORIGIN, json } from './wire';

/** The feature strings Wired advertises in NodeInfo and its v1 document. */
const FEATURES = ['pleroma_api', 'chat', 'pleroma_emoji_reactions', 'quote_posting'];

/** The post formats Wired lists in its v1 document; Markdown among them turns `markdown` on. */
const POST_FORMATS = ['text/plain', 'text/html', 'text/markdown'];

/** The routes that describe the instance to the capability builder (decision 5). */
function routeDiscovery(page: Page): readonly Promise<unknown>[] {
  return [
    page.route('**/.well-known/nodeinfo', async (route) => {
      const origin = new URL(route.request().url()).origin;
      await json(route, { links: [{ rel: NODEINFO_REL_21, href: `${origin}/nodeinfo/2.1` }] });
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
        pleroma: { metadata: { features: FEATURES, post_formats: POST_FORMATS } },
      });
    }),
    page.route('**/api/v2/instance', async (route) => {
      await json(route, { error: 'Record not found.' }, 404);
    }),
  ];
}

/** Registers every fake route on {@link page}, awaited before the page is used. */
export async function routeWired(page: Page): Promise<void> {
  await routeInstance(page, {
    discovery: routeDiscovery(page),
    content: {
      self: SELF,
      home: homeTimeline,
      notices: notifications,
      status: statusById,
      context: contextById,
      create: postedStatusJson,
    },
    reactions: true,
  });
}
