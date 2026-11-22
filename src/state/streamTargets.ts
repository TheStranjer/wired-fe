/**
 * Which windows a streaming frame is aimed at (AGENTS.md "Windows, like IRC
 * buffers"). A frame off an account's connection names the streams it arrived
 * on, and each window kind answers to one of them, the way the command that
 * opened it asked for them: `user` is the account's home timeline,
 * `public:local` and `public` its local and federated ones, and
 * `['hashtag', '<tag>']` the tag window `/tag` joined — matched any case and
 * with or without the `#`, because that is how the window is keyed. A post on
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

/** Whether {@link stream} names the stream {@link name}. */
function named(stream: readonly string[], name: string): boolean {
  return stream.includes(name);
}

/** The tag an update frame is for: the stream element right after `hashtag`. */
function tagOf(stream: readonly string[]): string | null {
  const index = stream.indexOf('hashtag');
  return index === -1 ? null : (stream[index + 1] ?? null);
}

/** The tag as `/tag` keys a window by: no leading `#`, lower case. */
function normalizeTag(tag: string): string {
  const bare = tag.startsWith('#') ? tag.slice(1) : tag;
  return bare.toLowerCase();
}

/** Whether this is the window for the frame's tag, whatever case it arrived in. */
function takesTag(win: WindowState, update: Update): boolean {
  const tag = tagOf(update.stream);
  return tag !== null && win.ref.target === normalizeTag(tag);
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
  return named(update.stream, 'user');
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
  local: (_win, update) => named(update.stream, 'public:local'),
  federated: (_win, update) => named(update.stream, 'public'),
  hashtag: takesTag,
  dm: takesDm,
  notifications: TAKES_NOTHING,
  thread: TAKES_NOTHING,
  profile: TAKES_NOTHING,
  search: TAKES_NOTHING,
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
