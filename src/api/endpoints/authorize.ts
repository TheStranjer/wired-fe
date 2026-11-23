/**
 * The third-party app authorization endpoints of wired-be (`/oauth/authorize`,
 * WFE-168): the browser `GET` is redirected to WiredFE, which asks the same
 * path for JSON — who is asking and for what — and, once the signed-in user
 * has chosen, answers with a bearer-authorised JSON `POST`. The answer to the
 * `POST` is where to send the browser (`redirect_uri`) or, for an out-of-band
 * app, the code itself.
 */
import * as v from 'valibot';

import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type ApiSession, sessionRequestData } from '../session';

/** Who is asking, what for, and where the answer goes. */
export type AuthorizeInfo = {
  readonly app: { readonly name: string; readonly website: string | null };
  /** The scopes the app asks for, one name each. */
  readonly scopes: readonly string[];
  readonly redirectUri: string;
  readonly state: string | null;
};

/** What the instance says to a decision: send the browser on, or show a code. */
export type AuthorizeDecision =
  | { readonly kind: 'redirect'; readonly uri: string }
  | { readonly kind: 'code'; readonly code: string };

/** The JSON body of a decision; `approve` says which one it is. */
export type AuthorizeBody = {
  readonly client_id: string;
  readonly redirect_uri: string;
  readonly scope: string;
  readonly state?: string;
  readonly code_challenge?: string;
  readonly code_challenge_method?: string;
  readonly approve: boolean;
};

/** The app-info answer; keys beyond these are dropped. */
const InfoSchema: v.GenericSchema<unknown, AuthorizeInfo> = v.pipe(
  v.object({
    app: v.object({ name: v.string(), website: v.optional(v.nullable(v.string()), null) }),
    scopes: v.array(v.string()),
    redirect_uri: v.string(),
    state: v.optional(v.nullable(v.string()), null),
  }),
  v.transform((body) => ({
    app: body.app,
    scopes: body.scopes,
    redirectUri: body.redirect_uri,
    state: body.state,
  })),
);

/** The decision answer: a `redirect_uri` wins over a `code`. */
const DecisionSchema: v.GenericSchema<unknown, AuthorizeDecision> = v.union([
  v.pipe(
    v.object({ redirect_uri: v.string() }),
    v.transform((body) => ({ kind: 'redirect' as const, uri: body.redirect_uri })),
  ),
  v.pipe(
    v.object({ code: v.string() }),
    v.transform((body) => ({ kind: 'code' as const, code: body.code })),
  ),
]);

/** Asks the instance who sent the browser here, for the request in {@link query}. */
export async function getAuthorizeInfo(
  session: ApiSession,
  query: Readonly<Record<string, string>>,
): Promise<Result<AuthorizeInfo, ApiError>> {
  return sessionRequestData(session, { path: '/oauth/authorize', query, schema: InfoSchema });
}

/** Sends the user's decision ({@link body}.approve) under the session's bearer token. */
export async function postAuthorize(
  session: ApiSession,
  body: AuthorizeBody,
): Promise<Result<AuthorizeDecision, ApiError>> {
  return sessionRequestData(session, {
    path: '/oauth/authorize',
    method: 'POST',
    json: body,
    schema: DecisionSchema,
  });
}
