/**
 * The external-login endpoints of wired-be (WFE-169), all anonymous: the
 * visitor has just come back from another provider and has no account here.
 * `GET /oauth/registration_details?state=` prefills the sign-up and
 * `POST /oauth/register` finishes it (an address to go to, or a wait for
 * approval or e-mail confirmation); `GET /oauth/external/consent` says which
 * app asks and `POST /oauth/external/consent` carries the answer. A refusal
 * (422 with an `error`, a bad state) arrives as the shared http error.
 */
import * as v from 'valibot';

import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type ApiSession, sessionRequestData } from '../session';

/** What the provider told wired-be about the visitor; absent parts are empty. */
export type RegistrationDetails = {
  readonly nickname: string;
  readonly email: string;
  readonly name: string;
  readonly provider: string;
};

/** The JSON body that finishes a registration; the password is left out when not chosen. */
export type ExternalRegisterBody = {
  readonly state: string;
  readonly nickname: string;
  readonly email: string;
  readonly password?: string;
};

/** What the instance says to a registration: go on, or wait for a step. */
export type ExternalRegistration =
  | { readonly kind: 'redirect'; readonly uri: string }
  | { readonly kind: 'pending'; readonly reason: 'approval' | 'confirmation' };

/** The app that wants an external login approved and what it asks for. */
export type ConsentInfo = {
  readonly app: { readonly name: string; readonly website: string | null };
  readonly scopes: readonly string[];
};

/** The JSON body of the consent answer. */
export type ConsentBody = {
  readonly state: string;
  readonly confirm_token: string;
  readonly approve: boolean;
};

/** A string that may be missing or null, read as the empty string. */
const TextSchema = v.optional(
  v.pipe(
    v.nullable(v.string()),
    v.transform((text) => text ?? ''),
  ),
  '',
);

/** The registration-details answer; keys beyond these are dropped. */
const DetailsSchema: v.GenericSchema<unknown, RegistrationDetails> = v.object({
  nickname: TextSchema,
  email: TextSchema,
  name: TextSchema,
  provider: TextSchema,
});

/** The register answer: an address to go to, or a pending step. */
const RegistrationSchema: v.GenericSchema<unknown, ExternalRegistration> = v.union([
  v.pipe(
    v.object({ redirect_uri: v.string() }),
    v.transform((body) => ({ kind: 'redirect' as const, uri: body.redirect_uri })),
  ),
  v.pipe(
    v.object({ pending: v.picklist(['approval', 'confirmation']) }),
    v.transform((body) => ({ kind: 'pending' as const, reason: body.pending })),
  ),
]);

/** The consent-info answer; keys beyond these are dropped. */
const ConsentSchema: v.GenericSchema<unknown, ConsentInfo> = v.object({
  app: v.object({ name: v.string(), website: v.optional(v.nullable(v.string()), null) }),
  scopes: v.array(v.string()),
});

/** The consent answer: the address to send the browser to. */
const RedirectSchema: v.GenericSchema<unknown, string> = v.pipe(
  v.object({ redirect_uri: v.string() }),
  v.transform((body) => body.redirect_uri),
);

/** What the provider told the instance about the visitor in {@link state}'s login. */
export async function getRegistrationDetails(
  session: ApiSession,
  state: string,
): Promise<Result<RegistrationDetails, ApiError>> {
  return sessionRequestData(session, {
    path: '/oauth/registration_details',
    query: { state },
    schema: DetailsSchema,
  });
}

/** Finishes the registration of {@link body}.state's login. */
export async function postExternalRegister(
  session: ApiSession,
  body: ExternalRegisterBody,
): Promise<Result<ExternalRegistration, ApiError>> {
  return sessionRequestData(session, {
    path: '/oauth/register',
    method: 'POST',
    json: body,
    schema: RegistrationSchema,
  });
}

/** Which app asks to be approved for the login of {@link state} and {@link confirmToken}. */
export async function getExternalConsent(
  session: ApiSession,
  state: string,
  confirmToken: string,
): Promise<Result<ConsentInfo, ApiError>> {
  return sessionRequestData(session, {
    path: '/oauth/external/consent',
    query: { state, confirm_token: confirmToken },
    schema: ConsentSchema,
  });
}

/** Sends the answer ({@link body}.approve) and resolves to the address to go to. */
export async function postExternalConsent(
  session: ApiSession,
  body: ConsentBody,
): Promise<Result<string, ApiError>> {
  return sessionRequestData(session, {
    path: '/oauth/external/consent',
    method: 'POST',
    json: body,
    schema: RedirectSchema,
  });
}
