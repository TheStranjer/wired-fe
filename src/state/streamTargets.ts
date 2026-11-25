/**
 * Which windows a streaming frame is aimed at (AGENTS.md "Windows, like IRC
 * buffers"). A frame off an account's connection names the streams it arrived
 * on, and each window kind answers to one of them, the way the command that
 * opened it asked for them: `user` is the account's home timeline,
 * `public:local` and `public` its local and federated ones, and
 * `['hashtag', '<tag>']` the tag window `/tag` joined — matched any case and
 * with or without the `#`, because that is how the window is keyed. wired-be
 * writes its internal names instead (`user:<id>`, `hashtag:<tag>`,
 * `hashtag:local:<tag>`); both namings route identically. A post on
 * the `user` stream that is `direct` is also the conversation each party
 * `/query`ed, found by handle the same way, with the account's own host
 * supplied when a backend reported a local actor as a bare username. Kinds no
 * stream addresses are named too, so a new window kind has to say where it
 * stands. Pure: the window list arrives as a parameter, nothing is dispatched.
 */

import { fullHandle } from '../accounts/handle';
import type { Status } from '../api/schemas/status';
import type { WindowKind, WindowState } from '../windows/model';

/** One update frame as the routing table sees it, with the receiving account's
 * origin: what completes a handle reported as a bare local username. */
export type Update = {
  readonly status: Status;
  readonly stream: readonly string[];
  readonly origin: string;
};

/** Whether the window {@link win} shows what an update frame carries. */
type TakesUpdate = (win: WindowState, update: Update) => boolean;

/** The stream families a frame's `stream` list belongs to. */
export type StreamFamilies = {
  readonly user: boolean;
  readonly publicLocal: boolean;
  readonly public: boolean;
  readonly tags: readonly string[];
};

/** Whether {@link name} is the account's own stream: Mastodon's `user`, or wired-be's
 * `user:<id>`, but not the notification or chat sub-streams. */
function isUserStream(name: string): boolean {
  if (name === 'user') {
    return true;
  }
  return (
    name.startsWith('user:') &&
    !name.startsWith('user:notification') &&
    !name.startsWith('user:pleroma_chat')
  );
}

/** The tag a wired-be `hashtag:<tag>` or `hashtag:local:<tag>` element names, if it is one. */
function prefixedTag(name: string): string | null {
  const rest = name.startsWith('hashtag:') ? name.slice('hashtag:'.length) : null;
  if (rest === null) {
    return null;
  }
  return rest.startsWith('local:') ? rest.slice('local:'.length) : rest;
}

/** Every tag the frame names: after a `hashtag` element, or inside a `hashtag:` one. */
function tagsOf(stream: readonly string[]): readonly string[] {
  const tags: string[] = [];
  stream.forEach((name, index) => {
    const next = stream[index + 1];
    const tag = name === 'hashtag' ? next : prefixedTag(name);
    if (tag !== undefined && tag !== null && tag !== '') {
      tags.push(tag);
    }
  });
  return tags;
}

/**
 * The families {@link stream} addresses, whichever naming the backend used:
 * Mastodon and Pleroma send `['user']` and `['hashtag', 'rust']`, wired-be
 * writes its internal `user:<id>` and `hashtag:<tag>` names. Names are exact:
 * `public:media` is neither local nor federated.
 */
export function streamFamilies(stream: readonly string[]): StreamFamilies {
  return {
    user: stream.some(isUserStream),
    publicLocal: stream.includes('public:local'),
    public: stream.includes('public'),
    tags: tagsOf(stream),
  };
}

/** The tag as `/tag` keys a window by: no leading `#`, lower case. */
export function normalizeTag(tag: string): string {
  const bare = tag.startsWith('#') ? tag.slice(1) : tag;
  return bare.toLowerCase();
}

/** Whether this is the window for one of the frame's tags, whatever case it arrived in. */
function takesTag(win: WindowState, update: Update): boolean {
  return streamFamilies(update.stream).tags.some((tag) => win.ref.target === normalizeTag(tag));
}

/** {@link handle} in the form a `dm` window's target holds: lower case, with the
 * account's host filled in when the backend reported a bare local username. */
function handleForm(handle: string, origin: string): string {
  const bare = handle.toLowerCase();
  return bare.includes('@') ? bare : `${bare}@${new URL(origin).hostname}`;
}

/** Everyone a direct post is between: whoever wrote it and everyone it mentions. */
function partiesOf(status: Status, origin: string): readonly string[] {
  return [fullHandle(status.account, origin), ...status.mentions.map((mention) => mention.acct)];
}

/** Whether the `user` stream carries the frame: this account's own timelines. */
function forUser(_win: WindowState, update: Update): boolean {
  return streamFamilies(update.stream).user;
}

/** A direct post on the account's own stream is also in each party's window. */
function takesDm(win: WindowState, update: Update): boolean {
  return forUser(win, update) && talksTo(win, update);
}

/** Whether this `dm` window talks to somebody the direct post in {@link update} is between. */
function talksTo(win: WindowState, update: Update): boolean {
  if (win.ref.target === null || update.status.visibility !== 'direct') {
    return false;
  }
  const wanted = handleForm(win.ref.target, update.origin);
  return partiesOf(update.status, update.origin).some(
    (party) => handleForm(party, update.origin) === wanted,
  );
}

/** A stream addresses no window of this kind. */
const TAKES_NOTHING: TakesUpdate = () => false;

/** Which window kinds answer to which streams, every kind named so a new one has to say. */
const TAKES_UPDATE: Record<WindowKind, TakesUpdate> = {
  status: TAKES_NOTHING,
  home: forUser,
  local: (_win, update) => streamFamilies(update.stream).publicLocal,
  federated: (_win, update) => streamFamilies(update.stream).public,
  hashtag: takesTag,
  dm: takesDm,
  notifications: TAKES_NOTHING,
  thread: TAKES_NOTHING,
  profile: TAKES_NOTHING,
  search: TAKES_NOTHING,
  composer: TAKES_NOTHING,
  feed: TAKES_NOTHING,
  feedEditor: TAKES_NOTHING,
  people: TAKES_NOTHING,
  media: TAKES_NOTHING,
};

/**
 * The open windows in {@link windows} that belong to {@link accountKey} and show
 * what {@link update} carries, in list order. A window of another account, a
 * closed one, and a kind no stream names are all left out.
 */
export function updateTargets(
  windows: readonly WindowState[],
  accountKey: string,
  update: Update,
): readonly WindowState[] {
  return windows.filter(
    (win) => win.ref.accountKey === accountKey && TAKES_UPDATE[win.ref.kind](win, update),
  );
}
