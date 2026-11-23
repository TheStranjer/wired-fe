/**
 * Tests for the decision body: the query's client, redirect URI, scope, state
 * and PKCE pair go through, the instance's reading fills what the query
 * lacks, and empty optional parameters are left out.
 */
import { describe, expect, it } from 'vitest';

import { authorizeBody } from './authorizeBody';
import type { AuthorizeInfo } from '../../api/endpoints/authorize';

const INFO: AuthorizeInfo = {
  app: { name: 'Cool App', website: null },
  scopes: ['read', 'follow'],
  redirectUri: 'https://cool.example/cb',
  state: 'from-info',
};

describe(authorizeBody, () => {
  it('carries everything the query had', () => {
    expect(
      authorizeBody(
        {
          client_id: 'c1',
          redirect_uri: 'https://other.example/cb',
          scope: 'write',
          state: 's1',
          code_challenge: 'ch',
          code_challenge_method: 'S256',
          response_type: 'code',
        },
        INFO,
        true,
      ),
    ).toStrictEqual({
      client_id: 'c1',
      redirect_uri: 'https://other.example/cb',
      scope: 'write',
      state: 's1',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
      approve: true,
    });
  });

  it('falls back to the instance’s reading and leaves out what is missing', () => {
    expect(authorizeBody({ client_id: 'c1', code_challenge: '' }, INFO, false)).toStrictEqual({
      client_id: 'c1',
      redirect_uri: 'https://cool.example/cb',
      scope: 'read follow',
      state: 'from-info',
      approve: false,
    });
  });

  it('sends no state when neither side has one', () => {
    expect(authorizeBody({ client_id: 'c1' }, { ...INFO, state: null }, true)).not.toHaveProperty(
      'state',
    );
  });
});
