/**
 * Tests for a response whose body cannot be read to the end: a rejected read
 * becomes `aborted` for an abort and `network` for anything else, never a throw.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { toApiResponse } from './response';
import { abortReason, failingBody } from '../test/failingBody';

const schema = v.object({ name: v.string() });

describe(toApiResponse, () => {
  it('reports a body read aborted after the headers arrived as aborted', async () => {
    const result = await toApiResponse(failingBody(abortReason()), schema);

    expect(result).toStrictEqual({ ok: false, error: { kind: 'aborted' } });
  });

  it('reports a body read that fails otherwise as a network error with its message', async () => {
    const result = await toApiResponse(failingBody(new TypeError('network error')), schema);

    expect(result).toStrictEqual({
      ok: false,
      error: { kind: 'network', message: 'network error' },
    });
  });

  it('reports a body read that rejects with a non-error by its string form', async () => {
    const result = await toApiResponse(failingBody('connection reset'), schema);

    expect(result).toStrictEqual({
      ok: false,
      error: { kind: 'network', message: 'connection reset' },
    });
  });
});
