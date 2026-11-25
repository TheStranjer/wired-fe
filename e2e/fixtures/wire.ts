/**
 * The Wired shapes the fake instance answers with (decisions 5 and 7): the
 * account, status and notification documents as Wired's own endpoints report
 * them, so the specs can build a body without restating every default. Keys and
 * defaults follow the schemas and fixtures in src/api; the values that go into
 * them are ./content's, and ./wired is what hands them out.
 */

import type { Route } from '@playwright/test';

/** A JSON object on the wire: every answer one of the endpoints gives is this. */
export type Json = Record<string, unknown>;

/** The preview server's origin: the instance a same-origin build connects to. */
export const ORIGIN = 'http://127.0.0.1:4173';

/** The host part of {@link ORIGIN}, which every handle here carries. */
export const HOST = new URL(ORIGIN).host;

/** Wired's encoder turns post text into entities; these three cover what specs post. */
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/** The body as Wired serves it: {@link text} with `&`, `<` and `>` turned into entities. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>]/gu, (c) => ENTITIES[c] ?? c);
}

/** Serves {@link body} as JSON with {@link status}; the strings src/api reads survive it. */
export async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** A local of the instance, as the specs know them: id, username, display name. */
export type Person = {
  readonly id: string;
  readonly name: string;
  readonly display: string;
};

/** The account document one local is reported as — verify_credentials and rows. */
export function accountJson(person: Person): Json {
  return {
    id: person.id,
    username: person.name,
    acct: person.name,
    fqn: `${person.name}@${HOST}`,
    display_name: person.display,
    created_at: '1998-07-06T00:00:00.000Z',
    note: `<p>${person.name}</p>`,
    url: `${ORIGIN}/users/${person.name}`,
    avatar: `${ORIGIN}/images/avi.png`,
    header: `${ORIGIN}/images/banner.png`,
    followers_count: 1,
    following_count: 1,
    statuses_count: 9,
  };
}

/** The mention the backend resolves for {@link person}. */
function mentionJson(person: Person): Json {
  return {
    id: person.id,
    username: person.name,
    acct: person.name,
    url: `${ORIGIN}/users/${person.name}`,
  };
}

/** One image attached to a post: where it is served from, and what it shows. */
type Picture = {
  readonly id: string;
  readonly url: string;
  readonly description: string;
};

/** The attachment document for {@link picture}: an image whose preview is itself. */
function pictureJson(picture: Picture): Json {
  return {
    id: picture.id,
    type: 'image',
    url: picture.url,
    preview_url: picture.url,
    remote_url: null,
    description: picture.description,
    blurhash: null,
  };
}

/** What a reply names: the post it answers, and the local who wrote that one. */
type Answers = {
  readonly to: string;
  readonly who: Person;
};

/** The fields that make a status the answer to {@link answers}. */
function replyFields(answers: Answers): Json {
  return { in_reply_to_id: answers.to, in_reply_to_account_id: answers.who.id };
}

/** The parts of a status a spec chooses; everything else is a wired default. */
export type Post = {
  readonly id: string;
  readonly who: Person;
  readonly html: string;
  readonly at: string;
  readonly warning?: string;
  readonly replies?: number;
  readonly boosts?: number;
  readonly favourites?: number;
  readonly answers?: Answers;
  /** Who the post names besides the one it answers; a direct post's recipients. */
  readonly mentions?: readonly Person[];
  readonly visibility?: string;
  readonly pictures?: readonly Picture[];
};

/** One status document: `html` is the body the backend has already rendered. */
export function statusJson(post: Post): Json {
  const { answers } = post;
  const named = post.mentions ?? (answers === undefined ? [] : [answers.who]);
  return {
    id: post.id,
    uri: `${ORIGIN}/posts/${post.id}`,
    created_at: post.at,
    account: accountJson(post.who),
    content: post.html,
    spoiler_text: post.warning ?? '',
    visibility: post.visibility ?? 'public',
    mentions: named.map(mentionJson),
    media_attachments: (post.pictures ?? []).map(pictureJson),
    replies_count: post.replies ?? 0,
    reblogs_count: post.boosts ?? 0,
    favourites_count: post.favourites ?? 0,
    pleroma: { local: true, conversation_id: `AhZconv${post.id}` },
    ...(answers === undefined ? {} : replyFields(answers)),
  };
}

/** The parts of a notification: who did what, when, and to which post. */
export type Notice = {
  readonly id: string;
  readonly type: string;
  readonly who: Person;
  readonly at: string;
  readonly status?: Json;
  readonly emoji?: string;
};

/** A notification document, the shape the list endpoint answers with. */
export function notificationJson(notice: Notice): Json {
  return {
    id: `AhZnotif${notice.id}`,
    type: notice.type,
    created_at: notice.at,
    account: accountJson(notice.who),
    status: notice.status ?? null,
    emoji: notice.emoji ?? null,
  };
}

/** A conversation document: the people other than the viewer, and its last word. */
export function conversationJson(id: string, people: readonly Person[], last: Json): Json {
  return { id, unread: true, accounts: people.map(accountJson), last_status: last };
}
