/**
 * The OAuth endpoints of an instance (decision 8): WiredFE registers itself as
 * an app at runtime, exchanges the authorization code of the login redirect
 * for an access token, trades a refresh token for a new pair, and revokes a
 * token again. All four are anonymous
 * calls — the app credentials travel in the JSON body, never a bearer token —
 * and go through `apiRequest` (./http) like every other call, so failures
 * arrive as the shared {@link ApiError} values.
 */
import * as v from 'valibot';

import type { ApiError } from './errors';
import { requestData } from './http';
import { NothingSchema } from './response';
import type { Result } from '../lib/result';

/** The scopes every app registration and token exchange asks for. */
export const OAUTH_SCOPES = 'read write follow push';

/** The credentials an instance hands back for a registered app. */
export type AppCredentials = {
  readonly client_id: string;
  readonly client_secret: string;
};

/**
 * An access token, with the type and scope string it comes with, plus the
 * refresh token and lifetime in seconds when the instance issues them (null
 * otherwise).
 */
export type Token = {
  readonly access_token: string;
  readonly token_type: string;
  readonly scope: string;
  readonly refresh_token: string | null;
  readonly expires_in: number | null;
};

/** A registered app's answer: the two credential strings; every other key dropped. */
export const AppCredentialsSchema: v.GenericSchema<unknown, AppCredentials> = v.object({
  client_id: v.string(),
  client_secret: v.string(),
});

/** A token answer: only `access_token` is required; the rest falls back. */
const TokenSchema: v.GenericSchema<unknown, Token> = v.object({
  access_token: v.string(),
  token_type: v.optional(v.string(), 'Bearer'),
  scope: v.optional(v.string(), ''),
  refresh_token: v.optional(v.nullable(v.string()), null),
  expires_in: v.optional(v.nullable(v.number()), null),
});

/**
 * Registers WiredFE as an OAuth app on the instance at {@link origin}
 * (decision 8), asking for {@link OAUTH_SCOPES} and the login
 * {@link params.redirectUri}.
 */
export async function registerApp(
  origin: string,
  params: { readonly appName: string; readonly redirectUri: string },
): Promise<Result<AppCredentials, ApiError>> {
  return requestData({
    origin,
    path: '/api/v1/apps',
    method: 'POST',
    json: {
      client_name: params.appName,
      redirect_uris: params.redirectUri,
      scopes: OAUTH_SCOPES,
    },
    schema: AppCredentialsSchema,
  });
}

/**
 * Exchanges the authorization code the login redirect brought back for an
 * access token, on behalf of the registered {@link params.app}.
 */
export async function exchangeCode(
  origin: string,
  params: {
    readonly app: AppCredentials;
    readonly code: string;
    readonly redirectUri: string;
  },
): Promise<Result<Token, ApiError>> {
  return requestData({
    origin,
    path: '/oauth/token',
    method: 'POST',
    json: {
      grant_type: 'authorization_code',
      code: params.code,
      client_id: params.app.client_id,
      client_secret: params.app.client_secret,
      redirect_uri: params.redirectUri,
      scope: OAUTH_SCOPES,
    },
    schema: TokenSchema,
  });
}

/**
 * Trades {@link params.refreshToken} for a new access and refresh token pair
 * (the `refresh_token` grant) on behalf of the registered {@link params.app}.
 */
export async function refreshAccessToken(
  origin: string,
  params: { readonly app: AppCredentials; readonly refreshToken: string },
): Promise<Result<Token, ApiError>> {
  return requestData({
    origin,
    path: '/oauth/token',
    method: 'POST',
    json: {
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
      client_id: params.app.client_id,
      client_secret: params.app.client_secret,
    },
    schema: TokenSchema,
  });
}

/** Revokes {@link params.token} on the instance at {@link origin}, logging the account out. */
export async function revokeToken(
  origin: string,
  params: { readonly app: AppCredentials; readonly token: string },
): Promise<Result<null, ApiError>> {
  return requestData({
    origin,
    path: '/oauth/revoke',
    method: 'POST',
    json: {
      client_id: params.app.client_id,
      client_secret: params.app.client_secret,
      token: params.token,
    },
    schema: NothingSchema,
  });
}
