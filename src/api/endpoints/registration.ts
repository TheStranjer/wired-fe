/**
 * Account registration (`POST /api/v1/accounts`, the Mastodon API wired-be
 * follows): a new account is created with an invite token under the app's own
 * token, never a user's. The answer is a token for the new account when the
 * instance hands one out, and may instead say that the address still has to be
 * confirmed or that a moderator still has to approve the account.
 */
import * as v from 'valibot';

import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { requestData } from '../http';
import { TOKEN_EXTRAS, type Token } from '../oauth';

/** What a visitor fills in to register. */
export type NewAccount = {
  readonly username: string;
  readonly email: string;
  readonly password: string;
  /** Why the visitor wants in; empty when they gave none. */
  readonly reason: string;
  /** The language the instance's mails to the new account are in, e.g. `en`. */
  readonly locale: string;
  /** The invite token of the `/registration/<token>` link. */
  readonly inviteToken: string;
};

/** What the instance answered to a registration. */
export type Registration = {
  /** The new account's token, or null when the instance issued none. */
  readonly token: Token | null;
  /** Whether the instance says the e-mail address must be confirmed first. */
  readonly confirmationRequired: boolean;
  /** Whether the instance says a moderator must approve the account first. */
  readonly approvalRequired: boolean;
};

/** The answer: an optional token with its extras, and the two optional flags. */
const RegistrationSchema: v.GenericSchema<unknown, Registration> = v.pipe(
  v.object({
    access_token: v.optional(v.string()),
    ...TOKEN_EXTRAS,
    confirmation_required: v.optional(v.boolean(), false),
    approval_required: v.optional(v.boolean(), false),
  }),
  v.transform((body) => ({
    token:
      body.access_token === undefined
        ? null
        : {
            access_token: body.access_token,
            token_type: body.token_type,
            scope: body.scope,
            refresh_token: body.refresh_token,
            expires_in: body.expires_in,
          },
    confirmationRequired: body.confirmation_required,
    approvalRequired: body.approval_required,
  })),
);

/** The JSON body of a registration: the agreement is always given, the reason only when there is one. */
function registrationBody(account: NewAccount): Record<string, unknown> {
  return {
    username: account.username,
    email: account.email,
    password: account.password,
    agreement: true,
    locale: account.locale,
    ...(account.reason === '' ? {} : { reason: account.reason }),
    token: account.inviteToken,
  };
}

/**
 * Creates {@link params.account} on the instance at {@link origin}, authorised
 * by {@link params.appToken}. A refusal arrives as the `http` error, whose
 * `details` carry the fields the instance rejected.
 */
export async function createAccount(
  origin: string,
  params: { readonly appToken: string; readonly account: NewAccount },
): Promise<Result<Registration, ApiError>> {
  return requestData({
    origin,
    path: '/api/v1/accounts',
    method: 'POST',
    token: params.appToken,
    json: registrationBody(params.account),
    schema: RegistrationSchema,
  });
}
