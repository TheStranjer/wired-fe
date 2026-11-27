/**
 * The content the fake Wired instance serves (decisions 5 and 7): the two local
 * accounts, the posts they have written, the conversation around the one the
 * specs open with `/thread a0`, the notices waiting in the `notifs` window, and
 * the echo of a status the session posts itself. ./wire turns each entry into
 * the document Wired answers with, and ./wired is what hands the documents out.
 */

import {
  HOST,
  ORIGIN,
  accountJson,
  conversationJson,
  escapeHtml,
  notificationJson,
  statusJson,
  type Json,
  type Notice,
  type Person,
  type Post,
} from './wire';

/** The handle `verify_credentials` proves, as Wired's fqn reports it. */
export const HANDLE = `lain@${HOST}`;

/** The plain text the specs post, so typing and asserting share one string. */
export const POSTED_TEXT = 'present day, present time';

/** The description of the one image the fixture posts carry, which the specs look it up by. */
export const IMAGE_ALT = 'The Wired mascot';

/** The instance's two locals: the account the session owns, and the one it reads. */
const LAIN: Person = { id: 'AhZlainAcc00000000000001', name: 'lain', display: 'Lain Iwakura' };
const ALICE: Person = { id: 'AhZalic3Acc00000000000001', name: 'alice', display: 'Alice' };

/** verify_credentials' answer: the account the session's token belongs to. */
export const SELF: Json = accountJson(LAIN);

/** One fixture moment: the specs' own day, at {@link clock} in the morning. */
function moment(clock: string): string {
  return `2026-11-15T${clock}:00.000Z`;
}

/** The ids the specs speak of: the thread's ancestor, its root, and its replies. */
const EYES = 'AhZst4tus00000000000000003';
const HERE = 'AhZst4tus00000000000000001';
const LAN = 'AhZst4tus00000000000000002';
const WIRED = 'AhZst4tus00000000000000004';
const SLEEP = 'AhZst4tus00000000000000005';
const CALL = 'AhZst4tus00000000000000006';
const DM = 'AhZst4tus00000000000000007';

/** The id of the post whose conversation is served: what a permalink to the thread names. */
export const THREAD_ROOT_ID = HERE;

/** The posts, in conversation order: the thread first, then the rest of home. */
const POSTS: readonly Post[] = [
  { id: EYES, who: LAIN, html: '<p>close the world. open your eyes.</p>', at: moment('08:55') },
  { id: HERE, who: ALICE, html: '<p>She is here.</p>', at: moment('08:58'), replies: 2 },
  {
    id: LAN,
    who: ALICE,
    html: '<p>the LAN is all one network</p>',
    at: moment('09:45'),
    pictures: [
      {
        id: 'AhZmedia0000000000000001',
        url: `${ORIGIN}/images/mascot.png`,
        description: IMAGE_ALT,
      },
    ],
  },
  {
    id: WIRED,
    who: LAIN,
    html: '<p>the wired is everywhere, all at once.</p>',
    at: moment('09:01'),
    answers: { to: HERE, who: ALICE },
  },
  {
    id: SLEEP,
    who: ALICE,
    html: '<p>sleep is not the answer.</p>',
    at: moment('09:03'),
    warning: 'dreams',
    answers: { to: WIRED, who: LAIN },
  },
  {
    id: CALL,
    who: ALICE,
    html: `<p><span class="mention">@${HANDLE}</span> are you there?</p>`,
    at: moment('09:30'),
    answers: { to: WIRED, who: LAIN },
  },
  {
    id: DM,
    who: ALICE,
    html: '<p>meet me where the wired ends.</p>',
    at: moment('09:20'),
    visibility: 'direct',
    mentions: [LAIN],
  },
];

/** Every fixture status by id, built once at module load. */
const BY_ID: ReadonlyMap<string, Json> = new Map(POSTS.map((one) => [one.id, statusJson(one)]));

/** The status document for fixture post {@link id}; a fixture bug if it has none. */
function post(id: string): Json {
  const found = BY_ID.get(id);
  if (found === undefined) {
    throw new Error(`no fixture post ${id}`);
  }
  return found;
}

/** GET /api/v1/timelines/home: what the account follows, newest first as served. */
export function homeTimeline(): readonly Json[] {
  return [post(LAN), post(HERE)];
}

/** GET /api/v1/statuses/:id: the post the id names, null for no such post. */
export function statusById(id: string): Json | null {
  return BY_ID.get(decodeURIComponent(id)) ?? null;
}

/** GET /api/v1/statuses/:id/context: HERE's conversation, nothing anywhere else. */
export function contextById(id: string): Json {
  if (id !== HERE) {
    return { ancestors: [], descendants: [] };
  }
  return { ancestors: [post(EYES)], descendants: [post(WIRED), post(SLEEP)] };
}

/** GET /api/v1/conversations: the one direct-message thread, with alice, its last word a DM. */
export function conversations(): readonly Json[] {
  return [conversationJson('AhZconvers0000000000001', [ALICE], post(DM))];
}

/** The notices the account has waiting, newest first as Wired serves them. */
const NOTICES: readonly Notice[] = [
  { id: '0005', type: 'reblog', who: LAIN, at: moment('09:40'), status: post(LAN) },
  {
    id: '0004',
    type: 'pleroma:emoji_reaction',
    who: LAIN,
    at: moment('09:35'),
    status: post(CALL),
    emoji: '🔥',
  },
  { id: '0003', type: 'mention', who: ALICE, at: moment('09:30'), status: post(CALL) },
  { id: '0002', type: 'favourite', who: ALICE, at: moment('09:10'), status: post(HERE) },
  { id: '0001', type: 'follow', who: ALICE, at: moment('09:05') },
];

/** GET /api/v1/notifications: every fixture notice, newest first. */
export function notifications(): readonly Json[] {
  return NOTICES.map(notificationJson);
}

/** POST /api/v1/statuses: post number {@link nth} of lain, saying {@link text}. */
export function postedStatusJson(text: string, nth: number): Json {
  return statusJson({
    id: String(900000000000000000 + nth),
    who: LAIN,
    html: `<p>${escapeHtml(text)}</p>`,
    at: new Date().toISOString(),
  });
}
