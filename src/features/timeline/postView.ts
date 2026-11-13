/**
 * The timeline slice's Status -> PostView mapping (AGENTS.md "Layout"): the
 * vertical slice that reads api entities and produces the plain data props
 * PostRow renders, since the ui layer never sees API types. Pure: one status
 * and the viewer go in, one immutable view model comes out. A boost displays
 * the original status with the booster's name attached to it.
 */

import { fullHandle } from '../../accounts/handle';
import type { Account } from '../../api/schemas/account';
import type { Status } from '../../api/schemas/status';

/** Who is looking: the instance origin handles are rendered against, and the
 * id of the active account, or null when nobody is signed in. */
type Viewer = {
  readonly origin: string;
  readonly accountId: string | null;
};

/** An account's two handle forms: the nick's short form and the @-prefixed
 * full one. */
type Handles = {
  readonly handle: string;
  readonly fullHandle: string;
};

/** The data props of one PostRow, derived from a single status. */
export type PostView = {
  /** The id of the displayed status (the original, for boosts). */
  readonly id: string;
  /** When the displayed status was created. */
  readonly date: Date;
  /** Who wrote the displayed status, and whether that is the viewer. */
  readonly author: {
    readonly handle: string;
    readonly fullHandle: string;
    readonly self: boolean;
  };
  /** The body as hostile remote HTML; RemoteHtml sanitizes it. */
  readonly contentHtml: string;
  /** The content warning of the displayed status; '' when there is none. */
  readonly spoilerText: string;
  /** Who boosted the displayed status; null when nothing was boosted. */
  readonly boostedBy: {
    readonly handle: string;
    readonly fullHandle: string;
  } | null;
};

/** The nick's two forms for an account seen from `origin`. */
function handles(account: Account, origin: string): Handles {
  return { handle: account.acct, fullHandle: `@${fullHandle(account, origin)}` };
}

/** The displayed status's author, flagged when it is the viewer themself. */
function authorOf(account: Account, viewer: Viewer): PostView['author'] {
  return {
    ...handles(account, viewer.origin),
    self: viewer.accountId !== null && account.id === viewer.accountId,
  };
}

/**
 * Map a status onto one row's data: a boost shows the reblogged status and
 * names the booster, anything else shows itself with no booster.
 */
export function postView(status: Status, viewer: Viewer): PostView {
  const boosted = status.reblog;
  const shown = boosted ?? status;
  return {
    id: shown.id,
    date: new Date(shown.created_at),
    author: authorOf(shown.account, viewer),
    contentHtml: shown.content,
    spoilerText: shown.spoiler_text,
    boostedBy: boosted === null ? null : handles(status.account, viewer.origin),
  };
}
