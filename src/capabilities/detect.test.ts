/**
 * Tests for instance detection (decision 5) over the shared MSW server: the
 * three documents go out at once and unauthenticated; a Wired instance yields
 * its NodeInfo features and the v1 `max_toot_chars` and title; a Mastodon one
 * takes title and limits from v2 and carries only `editing`; an unreadable
 * NodeInfo fails the detection; failing documents leave the defaults behind,
 * titled by the NodeInfo `nodeName` or, failing that, by the hostname.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { Backend } from './backend';
import { type Capabilities, type FeatureFlag, DEFAULT_POLL_LIMITS } from './capabilities';
import { type InstanceProfile, detectInstance } from './detect';
import { NODEINFO_REL_21 } from '../api/nodeinfo';
import { err, ok } from '../lib/result';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';

const DISCOVERY_PATH = '/.well-known/nodeinfo';

const NODEINFO_PATH = '/nodeinfo/2.1';

const V1_PATH = '/api/v1/instance';

const V2_PATH = '/api/v2/instance';

/** The title of the instance under test, and the hostname of {@link ORIGIN}. */
const TITLE = 'The Wired Lounge';

/** How a served document answers: its status, and the gate its request waits at. */
type Serving = { readonly status?: number; readonly hold?: () => Promise<void> };

/** The feature strings a Wired instance advertises in its NodeInfo metadata. */
const WIRED_FEATURES: readonly string[] = ['pleroma_emoji_reactions', 'quote_posting', 'editing'];

/** The flags {@link WIRED_FEATURES} turns on, plus the dialect's `localOnlyPosts` and `passwordResetApi`. */
const WIRED_FLAGS: readonly FeatureFlag[] = [
  'emojiReactions',
  'quotePosting',
  'editing',
  'localOnlyPosts',
  'passwordResetApi',
  'settingsStore',
];

/** The capabilities of a {@link backend} that advertises {@link flags} and no limits. */
function capsWith(
  backend: Backend,
  flags: readonly FeatureFlag[],
  extra: Partial<Capabilities> = {},
): Capabilities {
  return {
    backend,
    maxCharacters: 500,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set(flags),
    ...extra,
  };
}

/** The profile the detection is expected to answer for {@link ORIGIN}. */
function profile(title: string, capabilities: Capabilities): InstanceProfile {
  return { origin: ORIGIN, title, capabilities };
}

/** Fails unless {@link request} was sent without a bearer token. */
function expectAnonymous(request: Request): void {
  expect(request.headers.has('Authorization')).toBe(false);
}

/** Serves {@link body} at {@link ORIGIN}${path}, answering as {@link serving} says. */
function serve(path: string, body: Record<string, unknown>, serving: Serving = {}): void {
  const gate = serving.hold;
  server.use(
    http.get(`${ORIGIN}${path}`, async ({ request }) => {
      expectAnonymous(request);
      if (gate !== undefined) {
        await gate();
      }

      return HttpResponse.json(
        body,
        serving.status === undefined ? {} : { status: serving.status },
      );
    }),
  );
}

/** Serves {@link TITLE} on both instance documents. */
function serveTitles(): void {
  serve(V1_PATH, { title: TITLE, version: '2.7.2' });
  serve(V2_PATH, { title: TITLE, version: '2.7.2' });
}

/**
 * Serves a NodeInfo document naming {@link software} behind the discovery link.
 * Only discovery waits at {@link serving}'s gate: the document follows it.
 */
function serveNodeInfo(
  software: string,
  metadata: Record<string, unknown> = {},
  serving: Serving = {},
): void {
  serve(
    DISCOVERY_PATH,
    { links: [{ rel: NODEINFO_REL_21, href: `${ORIGIN}${NODEINFO_PATH}` }] },
    serving,
  );
  serve(NODEINFO_PATH, { version: '2.1', software: { name: software }, metadata });
}

/**
 * The gate of the concurrency test: {@link arrive} settles once {@link expected}
 * requests have arrived, so a detection that waited for one answer before
 * sending the next would never be answered at all.
 */
function arrivalGate(expected: number): {
  readonly arrive: () => Promise<void>;
  readonly arrived: () => number;
} {
  const allArrived = Promise.withResolvers<undefined>();
  let count = 0;
  return {
    arrive: async () => {
      count += 1;
      if (count === expected) {
        allArrived.resolve(undefined);
      }
      await allArrived.promise;
    },
    arrived: () => count,
  };
}

describe(detectInstance, () => {
  it('detects a Wired instance from its features and the v1 document', async () => {
    serveNodeInfo('Wired', { features: WIRED_FEATURES });
    serve(V1_PATH, {
      title: TITLE,
      version: '2.7.2',
      max_toot_chars: 1_000,
      pleroma: { metadata: { post_formats: ['text/plain', 'text/markdown'] } },
    });
    serve(V2_PATH, { error: 'Not Found' }, { status: 404 });

    const result = await detectInstance(ORIGIN);

    expect(result).toStrictEqual(
      ok(profile(TITLE, capsWith('wired', [...WIRED_FLAGS, 'markdown'], { maxCharacters: 1_000 }))),
    );
  });

  it('detects a Mastodon instance by its v2 title, editing and, at API version 12, quotes', async () => {
    serveNodeInfo('Mastodon', { nodeName: 'ignored.example' });
    serve(V1_PATH, {
      title: 'Old Lounge',
      version: '4.3.0',
      configuration: { statuses: { max_characters: 500 } },
    });
    serve(V2_PATH, {
      title: 'New Lounge',
      version: '4.3.0',
      api_versions: { mastodon: 12 },
      configuration: { statuses: { max_characters: 5_000, max_media_attachments: 6 } },
    });

    const result = await detectInstance(ORIGIN);

    expect(result).toStrictEqual(
      ok(
        profile(
          'New Lounge',
          capsWith('mastodon', ['editing', 'quotePosting'], {
            maxCharacters: 5_000,
            maxMediaAttachments: 6,
          }),
        ),
      ),
    );
  });

  it('sends the three requests at the same time, unauthenticated', async () => {
    const gate = arrivalGate(3);
    const hold = gate.arrive;
    serveNodeInfo('Wired', { features: WIRED_FEATURES }, { hold });
    serve(V1_PATH, { title: TITLE, version: '2.7.2' }, { hold });
    serve(V2_PATH, { error: 'Not Found' }, { status: 404, hold });

    const result = await detectInstance(ORIGIN);

    expect(gate.arrived()).toBe(3);
    expect(result).toStrictEqual(ok(profile(TITLE, capsWith('wired', WIRED_FLAGS))));
  });

  it('cancels the detection with an aborted signal', async () => {
    serveNodeInfo('Wired');
    serveTitles();
    const controller = new AbortController();
    controller.abort();

    const result = await detectInstance(ORIGIN, controller.signal);

    expect(result).toStrictEqual(err({ kind: 'aborted' }));
  });

  it('fails with the NodeInfo error when the instance has none', async () => {
    serveTitles();
    server.use(
      http.get(`${ORIGIN}${DISCOVERY_PATH}`, () => {
        return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
      }),
    );

    const result = await detectInstance(ORIGIN);

    expect(result).toStrictEqual(err({ kind: 'http', status: 404, message: 'Not Found' }));
  });

  it('keeps the defaults and the NodeInfo name when both documents fail', async () => {
    serveNodeInfo('Wired', { nodeName: TITLE });
    serve(V1_PATH, { error: 'Boom' }, { status: 500 });
    serve(V2_PATH, { error: 'Not Found' }, { status: 404 });

    const result = await detectInstance(ORIGIN);

    const flags = WIRED_FLAGS.slice(3);

    expect(result).toStrictEqual(ok(profile(TITLE, capsWith('wired', flags))));
  });

  it('names the instance by its hostname when nothing carries a title', async () => {
    serveNodeInfo('Mastodon');
    serve(V1_PATH, { error: 'Boom' }, { status: 500 });
    serve(V2_PATH, { error: 'Boom' }, { status: 500 });

    const result = await detectInstance(ORIGIN);

    expect(result).toStrictEqual(ok(profile('wired.example', capsWith('mastodon', ['editing']))));
  });
});
