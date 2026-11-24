/**
 * Tests for the external-login routes: the register route carries its state,
 * the consent route its state and confirm token, missing parameters become
 * empty strings, and any other hash is not one.
 */
import { describe, expect, it } from 'vitest';

import { parseExternalRoute } from './externalRoute';

describe(parseExternalRoute, () => {
  it('reads the state of the register route', () => {
    expect(parseExternalRoute('#/oauth/external/register?state=abc%20d')).toStrictEqual({
      kind: 'register',
      state: 'abc d',
    });
  });

  it('reads the state and confirm token of the consent route', () => {
    expect(parseExternalRoute('#/oauth/external/consent?state=s1&confirm_token=t1')).toStrictEqual({
      kind: 'consent',
      state: 's1',
      confirmToken: 't1',
    });
  });

  it('keeps missing parameters as empty strings', () => {
    expect(parseExternalRoute('#/oauth/external/register')).toStrictEqual({
      kind: 'register',
      state: '',
    });
    expect(parseExternalRoute('#/oauth/external/consent?other=1')).toStrictEqual({
      kind: 'consent',
      state: '',
      confirmToken: '',
    });
  });

  it.each(['', '#/oauth/authorize?state=1', '#/oauth/external/other?state=1', '#/notice/1'])(
    'is null for %j',
    (hash) => {
      expect(parseExternalRoute(hash)).toBeNull();
    },
  );
});
